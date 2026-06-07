type Entities = {
  mathExpression?: string;
  mathResult?: number | null;
  conversion?: {
    value: number;
    from: string;
    to: string;
    result: number | null;
  };
  now?: Date;
};

function tryParseMath(raw: string): Entities | null {
  const expr = raw.replace(/[^0-9+\-*/().\s]/g, "").trim();
  if (!expr) return null;
  if (!/\d/.test(expr)) return null;
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null;
  if (!/[+\-*/]/.test(expr)) return null;

  try {
    const fn = new Function(`return (${expr});`);
    const value = Number(fn());
    if (!Number.isFinite(value)) return { mathExpression: expr, mathResult: null };
    return { mathExpression: expr, mathResult: value };
  } catch {
    return { mathExpression: expr, mathResult: null };
  }
}

// Lightweight tokenizer
function tokenize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\n\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Intent definitions with keyword sets for broader matching and scoring
const INTENT_KEYWORDS: Record<string, { topic: string; keywords: string[] }> = {
  greet: { topic: "greeting", keywords: ["hello", "hi", "hey", "greetings"] },
  identity: { topic: "identity", keywords: ["who are you", "what are you", "identity", "your name"] },
  status: { topic: "smalltalk", keywords: ["what are you doing", "what's up", "up to"] },
  wellbeing: { topic: "smalltalk", keywords: ["how are you", "how's it going"] },
  time: { topic: "time", keywords: ["what time", "time now", "current time"] },
  date: { topic: "date", keywords: ["what date", "today's date", "what day"] },
  weather: { topic: "weather", keywords: ["weather", "forecast", "rain", "sunny", "temperature"] },
  help: { topic: "help", keywords: ["help", "assist", "how to"] },
  joke: { topic: "humor", keywords: ["joke", "funny", "make me laugh"] },
  goodbye: { topic: "farewell", keywords: ["bye", "goodbye", "see you"] },
  thanks: { topic: "gratitude", keywords: ["thanks", "thank you", "thx"] },
  convert: { topic: "conversion", keywords: ["convert", "conversion", "inches", "celsius", "fahrenheit", "km", "miles"] },
  math: { topic: "math", keywords: ["+", "-", "*", "/", "plus", "minus", "times", "divided"] },
  programming: { topic: "programming", keywords: ["code", "bug", "error", "build", "test"] },
  games: { topic: "games", keywords: ["game", "play", "score", "level"] },
};

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase();
  if (u === "c" || u === "celsius") return "c";
  if (u === "f" || u === "fahrenheit") return "f";
  if (u === "cm" || u === "centimeter" || u === "centimeters") return "cm";
  if (u === "in" || u === "inch" || u === "inches") return "in";
  if (u === "m" || u === "meter" || u === "meters") return "m";
  if (u === "ft" || u === "foot" || u === "feet") return "ft";
  if (u === "km" || u === "kilometer" || u === "kilometers") return "km";
  if (u === "mi" || u === "mile" || u === "miles") return "mi";
  return u;
}

function convertValue(value: number, from: string, to: string): number | null {
  if (from === "c" && to === "f") return (value * 9) / 5 + 32;
  if (from === "f" && to === "c") return ((value - 32) * 5) / 9;
  if (from === "cm" && to === "in") return value / 2.54;
  if (from === "in" && to === "cm") return value * 2.54;
  if (from === "m" && to === "ft") return value * 3.28084;
  if (from === "ft" && to === "m") return value / 3.28084;
  if (from === "km" && to === "mi") return value * 0.621371;
  if (from === "mi" && to === "km") return value / 0.621371;
  return null;
}

function tryParseConversion(raw: string): {
  value: number;
  from: string;
  to: string;
  result: number | null;
} | null {
  const match = raw.match(
    /(\d+(?:\.\d+)?)\s*(c|f|celsius|fahrenheit|cm|centimeters?|inches?|in|m|meters?|ft|feet|km|kilometers?|mi|miles?)\s*(?:to|in)\s*(c|f|celsius|fahrenheit|cm|centimeters?|inches?|in|m|meters?|ft|feet|km|kilometers?|mi|miles?)/,
  );
  if (!match) return null;
  const value = Number(match[1]);
  const from = normalizeUnit(match[2]);
  const to = normalizeUnit(match[3]);
  if (!Number.isFinite(value) || !from || !to) return null;
  const result = convertValue(value, from, to);
  return { value, from, to, result };
}

export function parse(text: string, options?: { smart?: boolean; thinkMs?: number }) {
  const raw = String(text || "");
  const t = raw.toLowerCase();
  const tokens = tokenize(raw);

  const entities: Entities = {};

  // First, entity-specific parsing (math, conversion)
  const math = tryParseMath(t);
  if (math) {
    entities.mathExpression = math.mathExpression;
    entities.mathResult = math.mathResult;
  }
  const conv = tryParseConversion(t);
  if (conv) entities.conversion = conv;

  // Scoring across intent keyword sets
  const scores: Record<string, number> = {};
  for (const k of Object.keys(INTENT_KEYWORDS)) scores[k] = 0;

  // Exact phrase matches get higher weight
  for (const [intent, def] of Object.entries(INTENT_KEYWORDS)) {
    for (const phrase of def.keywords) {
      if (t.includes(phrase)) scores[intent] += 3;
    }
  }

  // Token matches add smaller weight
  for (const token of tokens) {
    for (const [intent, def] of Object.entries(INTENT_KEYWORDS)) {
      for (const kw of def.keywords) {
        if (kw.includes(" ")) continue; // skip multi-word here
        if (token === kw || token.startsWith(kw) || token.endsWith(kw)) scores[intent] += 1;
      }
    }
  }

  // Fallback regex checks for some patterns (keep previous behavior)
  if (/\bwhat time is it|current time|time now\b/.test(t)) scores.time += 2;
  if (/\bwhat date is it|today's date|what day is it\b/.test(t)) scores.date += 2;

  // Decide top intent
  let intent = "unknown";
  let topic = "general";
  let reasoning = "No strong matches; defaulting to unknown intent.";

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = entries[0] ?? ["unknown", 0];

  const alternatives = entries.slice(1, 4).map(([k, v]) => ({ intent: k, score: v }));

  if (topScore > 0) {
    intent = topIntent;
    topic = INTENT_KEYWORDS[topIntent].topic || "general";
    reasoning = `Top match: ${topIntent} (score=${topScore}). Alternatives: ${alternatives
      .map((a) => `${a.intent}:${a.score}`)
      .join(", ")}`;
  } else if (entities.mathExpression) {
    intent = "math";
    topic = "math";
    reasoning = "Parsed math expression with low ambiguity.";
  }

  // If conversion entity explicitly parsed, prefer convert intent
  if (entities.conversion) {
    intent = "convert";
    topic = "conversion";
    reasoning = reasoning + " | Conversion detected in text.";
  }

  const result = { intent, topic, reasoning, entities };

  if (options && options.smart) {
    const ms = Math.min(10000, Math.max(0, options.thinkMs || 500));
    return new Promise((resolve) => setTimeout(() => resolve(result), ms));
  }

  return result;
}

// Infer intent from arbitrary text (used for search titles/snippets)
export function inferIntentFromText(text: string) {
  const t = String(text || "").toLowerCase();
  const tokens = tokenize(t);

  const scores: Record<string, number> = {};
  for (const k of Object.keys(INTENT_KEYWORDS)) scores[k] = 0;

  for (const [intent, def] of Object.entries(INTENT_KEYWORDS)) {
    for (const phrase of def.keywords) {
      if (t.includes(phrase)) scores[intent] += 2; // lower weight from search
    }
  }
  for (const token of tokens) {
    for (const [intent, def] of Object.entries(INTENT_KEYWORDS)) {
      for (const kw of def.keywords) {
        if (kw.includes(" ")) continue;
        if (token === kw || token.startsWith(kw) || token.endsWith(kw)) scores[intent] += 1;
      }
    }
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = entries[0] ?? ["unknown", 0];
  if (topScore > 0) return { intent: topIntent, score: topScore };
  return { intent: "unknown", score: 0 };
}
