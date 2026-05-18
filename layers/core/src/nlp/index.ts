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

export function parse(text: string) {
  const t = String(text).toLowerCase();

  let intent = "unknown";
  let topic = "general";
  let reasoning = "No known patterns matched. Defaulting to unknown intent.";
  const entities: Entities = {};

  if (/\bhello|hi\b/.test(t)) {
    intent = "greet";
    topic = "greeting";
    reasoning = "Matched greeting keyword (hello/hi).";
  } else if (/\bwho are you|what are you\b/.test(t)) {
    intent = "identity";
    topic = "identity";
    reasoning = "Matched identity question.";
  } else if (/\bwhat are you doing|what's up|what are you up to\b/.test(t)) {
    intent = "status";
    topic = "smalltalk";
    reasoning = "Matched status/smalltalk question.";
  } else if (/\bhow are you\b/.test(t)) {
    intent = "wellbeing";
    topic = "smalltalk";
    reasoning = "Matched wellbeing question.";
  } else if (/\bwhat time is it|current time|time now\b/.test(t)) {
    intent = "time";
    topic = "time";
    reasoning = "Matched time question.";
  } else if (/\bwhat date is it|today's date|what day is it\b/.test(t)) {
    intent = "date";
    topic = "date";
    reasoning = "Matched date question.";
  } else if (/\bweather|rain|sunny|forecast|temperature|todays weather|today's weather|what is the weather|what is weather today\b/.test(t)) {
    intent = "weather";
    topic = "weather";
    reasoning = "Matched weather question.";
  } else if (/\bhelp\b/.test(t)) {
    intent = "help";
    topic = "help";
    reasoning = "Matched help keyword.";
  } else if (/\bjoke\b/.test(t)) {
    intent = "joke";
    topic = "humor";
    reasoning = "Matched request for humor.";
  } else if (/\bbye|goodbye|see you\b/.test(t)) {
    intent = "goodbye";
    topic = "farewell";
    reasoning = "Matched farewell pattern.";
  } else if (/\bthank(s| you)\b/.test(t)) {
    intent = "thanks";
    topic = "gratitude";
    reasoning = "Matched gratitude pattern.";
  } else if (/\bconvert|conversion|inches|centimeters|fahrenheit|celsius|meters|feet|kilometers|miles\b/.test(t)) {
    const conv = tryParseConversion(t);
    if (conv) {
      intent = "convert";
      topic = "conversion";
      entities.conversion = conv;
      reasoning = "Parsed unit conversion request.";
    }
  } else if (/\bgame|play|score|level\b/.test(t)) {
    topic = "games";
    reasoning = "Matched game keyword.";
  } else if (/\bwork|job|career|boss\b/.test(t)) {
    topic = "work";
    reasoning = "Matched work keyword.";
  } else if (/\bhealth|sick|doctor|pain\b/.test(t)) {
    topic = "health";
    reasoning = "Matched health keyword.";
  } else if (/\bcode|bug|error|build|test\b/.test(t)) {
    topic = "programming";
    reasoning = "Matched programming keyword.";
  } else {
    const math = tryParseMath(t);
    if (math) {
      intent = "math";
      topic = "math";
      entities.mathExpression = math.mathExpression;
      entities.mathResult = math.mathResult;
      reasoning = "Parsed simple math expression.";
    }
  }

  return { intent, topic, reasoning, entities };
}

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
