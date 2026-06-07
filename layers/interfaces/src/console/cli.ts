import readline from "readline";
import { parse, inferIntentFromText, respond } from "@ditroy/core";
import { decorate } from "@ditroy/core/personality";
import { basicSearch } from "@ditroy/core/search";
import { resolveTypos } from "@ditroy/core/typo";
import { getCachedResponse } from "@ditroy/data/db";

export async function handleOnce(text: string) {
  // Used for basic stateless testing
  const typo = await resolveTypos(text);
  const thinkMs = Number(process.env.DITROY_THINK_MS) || 2000;
  const smartEnabled =
    process.env.DITROY_SMART === "1" ||
    process.env.DITROY_SMART === "true" ||
    process.env.DITROY_SMART === undefined; // default: enabled
  const parsed = await (parse as any)(typo.corrected, { smart: smartEnabled, thinkMs });
  const { intent, topic, reasoning, entities } = parsed as any;
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

  // teaching mode removed: the assistant will attempt to infer intent automatically
  let suggestionPendingOriginal: string | null = null;
  let suggestionText: string | null = null;

  rl.on("line", async (line: string) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }

    // If a suggestion is pending, treat this input as acceptance/decline
    if (suggestionPendingOriginal) {
      const answer = text.toLowerCase();
      if (answer === "y" || answer === "yes") {
        const decorated = decorate(suggestionText || "", { tone: "warm" });
        console.log(`\n${decorated}\n`);
        suggestionPendingOriginal = null;
        suggestionText = null;
        rl.setPrompt("> ");
        rl.prompt();
        return;
      }
      // decline -> do not enter teaching mode; just clear suggestion and continue
      suggestionPendingOriginal = null;
      suggestionText = null;
      console.log("Okay, not using the suggestion.");
      rl.setPrompt("> ");
      rl.prompt();
      return;
    }

    // teaching mode disabled: assistant will try to infer and auto-respond instead of asking the user to teach

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
    const thinkMs = Number(process.env.DITROY_THINK_MS) || 2000;
    const smartEnabled =
      process.env.DITROY_SMART === "1" ||
      process.env.DITROY_SMART === "true" ||
      process.env.DITROY_SMART === undefined;
    const parsed = await (parse as any)(typo.corrected, {
      smart: smartEnabled,
      thinkMs,
    });
    const { intent, topic, reasoning, entities } = parsed as any;
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

    // 4. When unknown, attempt automatic inference using web search and data; do not prompt user to teach
    if (intent === "unknown") {
      console.log(
        `\x1b[90m[Thoughts: ${reasoningLine} -> Intent: ${intent} -> Topic: ${topic}]\x1b[0m`,
      );
      let inferred = { intent: "unknown", score: 0 };
        const inferThreshold = Number(process.env.DITROY_INFER_CONF) || 2;
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
          const combined = results
            .map((r) => `${r.title} ${r.snippet}`)
            .join(" \n ");
          if (combined) {
            inferred = inferIntentFromText(combined);
          }
        } catch (e) {
          console.warn("Web search failed:", e);
        }
      }

      if (inferred.intent !== "unknown" && inferred.score >= inferThreshold) {
        console.log(
          `\x1b[90m[Inferred Intent from web: ${inferred.intent} (score=${inferred.score})]\x1b[0m`,
        );
        (entities as any).inferred = true;
        const inferredIntent = inferred.intent;
        const base = respond(inferredIntent, entities);
        const decorated = decorate(base, { tone: "warm" });
        console.log(
          `\x1b[90m[Thoughts: ${reasoningLine} | Inferred: ${inferredIntent}]\x1b[0m\n${decorated}\n`,
        );
        rl.prompt();
        return;
      }

      // still unknown -> auto-generate a friendly clarification or reply using respond()
      const autoReply = respond("unknown", { topic: typo.corrected });
      console.log("I don't know how to respond to that.");
      console.log(`Suggested reply: ${autoReply}\n`);
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
