import readline from "readline";
import { parse } from "@ditroy/core/nlp";
import { respond } from "@ditroy/core/dialogue";
import { decorate } from "@ditroy/core/personality";
import { basicSearch } from "@ditroy/core/search";
import { resolveTypos } from "@ditroy/core/typo";
import { getCachedResponse, saveLearnedResponse } from "@ditroy/data/db";

export async function handleOnce(text: string) {
  // Used for basic stateless testing
  const typo = await resolveTypos(text);
  const { intent, topic, reasoning, entities } = parse(typo.corrected);
  if (intent === "time" || intent === "date") {
    entities.now = new Date();
  }
  const reasoningLine = typo.corrections.length
    ? `${reasoning} | ${typo.reasoning}`
    : reasoning;
  const base = respond(intent, entities);
  const decorated = decorate(base, { tone: "warm" });
  return `\x1b[90m[Thoughts: ${reasoningLine} -> Intent: ${intent} -> Topic: ${topic}]\x1b[0m\n${decorated}`;
}

export function runConsole() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log("DITroy v1 — type a message and press Enter (ctrl+C to quit)");
  rl.setPrompt("> ");
  rl.prompt();

  let teachingInput: string | null = null;
  let teachingIntent: string | null = null;
  let teachingTopic: string | null = null;
  let teachingReasoning: string | null = null;

  rl.on("line", async (line: string) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }

    // 1. If currently in Teaching Mode
    if (teachingInput) {
      if (!teachingIntent) {
        teachingIntent = text.trim() || "custom";
        console.log("What topic should I record for this?");
        rl.setPrompt("\x1b[33m(Teach DITroy - Topic) >\x1b[0m ");
        rl.prompt();
        return;
      }

      if (!teachingTopic) {
        teachingTopic = text.trim() || "custom";
        console.log("What should I say in response?");
        rl.setPrompt("\x1b[33m(Teach DITroy - Response) >\x1b[0m ");
        rl.prompt();
        return;
      }

      await saveLearnedResponse(teachingInput, text, {
        intent: teachingIntent,
        topic: teachingTopic,
        reasoning: teachingReasoning ?? "Taught by user.",
      });
      console.log(
        `\x1b[32m[Memory Updated: I will recall this response for next time!]\x1b[0m\n`,
      );
      teachingInput = null;
      teachingIntent = null;
      teachingTopic = null;
      teachingReasoning = null;
      rl.setPrompt("> ");
      rl.prompt();
      return;
    }

    // 2. Check Database / Cache first
    const cached = await getCachedResponse(text);
    if (cached) {
      const decorated = decorate(cached.response, { tone: "warm" });
      console.log(
        `\x1b[90m[Thoughts: ${cached.reasoning} -> Intent: ${cached.intent} -> Topic: ${cached.topic}]\x1b[0m\n${decorated}\n`,
      );
      rl.prompt();
      return;
    }

    // 3. Fallback to NLP parsing
    const typo = await resolveTypos(text);
    const { intent, topic, reasoning, entities } = parse(typo.corrected);
    if (intent === "time" || intent === "date") {
      entities.now = new Date();
    }
    const reasoningLine = typo.corrections.length
      ? `${reasoning} | ${typo.reasoning}`
      : reasoning;

    const searchEnabled =
      process.env.DITROY_WEB_SEARCH === "1" ||
      process.env.DITROY_WEB_SEARCH === "true";

    if (intent === "weather" && searchEnabled) {
      try {
        const results = await basicSearch(typo.corrected);
        if (results.length) {
          console.log("\nTop web results:");
          for (const r of results) {
            console.log(`- ${r.title}\n  ${r.url}`);
            if (r.snippet) console.log(`  ${r.snippet}`);
          }
          console.log("");
        }
      } catch (e) {
        console.warn("Web search failed:", e);
      }
      const base = respond(intent, entities);
      const decorated = decorate(base, { tone: "warm" });
      console.log(
        `\x1b[90m[Thoughts: ${reasoningLine} -> Intent: ${intent} -> Topic: ${topic}]\x1b[0m\n${decorated}\n`,
      );
      rl.prompt();
      return;
    }

    // 4. Trigger Teaching Mode for unknowns
    if (intent === "unknown") {
      teachingInput = text;
      teachingReasoning = reasoningLine;
      console.log(
        `\x1b[90m[Thoughts: ${reasoningLine} -> Intent: ${intent} -> Topic: ${topic}]\x1b[0m`,
      );
      if (searchEnabled) {
        try {
          const results = await basicSearch(typo.corrected);
          if (results.length) {
            console.log("\nTop web results:");
            for (const r of results) {
              console.log(`- ${r.title}\n  ${r.url}`);
              if (r.snippet) console.log(`  ${r.snippet}`);
            }
            console.log("");
          }
        } catch (e) {
          console.warn("Web search failed:", e);
        }
      }
      console.log("I don't know how to respond to that.");
      console.log("What intent should I record for this?");
      rl.setPrompt("\x1b[33m(Teach DITroy - Intent) >\x1b[0m ");
      rl.prompt();
      return;
    }

    // 5. Output normal rule-based response
    const base = respond(intent, entities);
    const decorated = decorate(base, { tone: "warm" });
    console.log(
      `\x1b[90m[Thoughts: ${reasoningLine} -> Intent: ${intent} -> Topic: ${topic}]\x1b[0m\n${decorated}\n`,
    );
    rl.prompt();
  });
}
