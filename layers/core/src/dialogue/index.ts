import * as gen from "./generator.js";

export function respond(intent: string, context: Record<string, any> = {}) {
  if (intent === "math") {
    if (typeof context.mathResult === "number") {
      return `The answer is ${context.mathResult}.`;
    }
    return "I can see a math expression, but I couldn't evaluate it.";
  }
  if (intent === "time") {
    const now = context.now instanceof Date ? context.now : new Date();
    return `It's ${now.toLocaleTimeString()}.`;
  }
  if (intent === "date") {
    const now = context.now instanceof Date ? context.now : new Date();
    return `Today's date is ${now.toLocaleDateString()}.`;
  }
  if (intent === "convert") {
    const conv = context.conversion;
    if (conv && typeof conv.result === "number") {
      return `${conv.value} ${conv.from} is ${conv.result.toFixed(2)} ${conv.to}.`;
    }
    return "I can convert units like C/F, cm/in, m/ft, and km/mi.";
  }
  // Use generator-based responses instead of fixed strings where possible
  switch (intent) {
    case "greet":
      return gen.genGreeting();
    case "help":
      return gen.genFriendlyQuestion("what you need");
    case "joke":
      // keep a tiny hand-crafted fallback for jokes
      return "I don't have a big joke generator yet, but here's one: Why did the developer go broke? Because he used up all his cache.";
    case "goodbye":
      return gen.genFarewell();
    case "thanks":
      return gen.genThanks();
    case "identity":
      return gen.genShortReply("myself");
    case "status":
      return gen.genShortReply("ready");
    case "wellbeing":
      return gen.genShortReply("well");
    case "weather":
      return gen.genFriendlyQuestion("the weather");
    default:
      // fallback: try to construct a helpful sentence
      if (context && context.topic)
        return gen.genFriendlyQuestion(context.topic);
      return gen.genShortReply();
  }
}

export function suggestClarification(input: string) {
  const t = String(input || "").trim();
  if (!t) return "Could you clarify that?";

  // Short token heuristics
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && tokens[0].length <= 3) {
    const w = tokens[0].toLowerCase();
    const guesses: string[] = [];
    if (w === "as") {
      guesses.push("a typo for 'ask'");
      guesses.push("part of a longer phrase — please expand");
      guesses.push("an abbreviation like 'asynchronous' or 'assistant'");
    } else if (w.length <= 2) {
      guesses.push("a short abbreviation or typo — please clarify");
      guesses.push("did you mean to start a question? Try 'ask ...'");
    }
    return `I didn't catch '${t}'. Possible meanings: ${guesses.join(", ")}. Could you clarify what you meant?`;
  }

  // Fallback
  return `Could you clarify what you mean by "${t}"?`;
}
