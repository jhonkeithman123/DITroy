import { buildModelFromRepoFiles, generateFromModel } from "./ngram.js";

const ORDER = Number(process.env.DITROY_NGRAM_ORDER) || 3;
const DEFAULT_LEN = Number(process.env.DITROY_GEN_LENGTH) || 10;

// build model once
const MODEL = buildModelFromRepoFiles(ORDER);

export function genShortReply(topic?: string) {
  const seed = topic ? topic.split(/\s+/).slice(0, ORDER - 1).join(" ") : undefined;
  const out = generateFromModel(MODEL, ORDER, Math.max(5, DEFAULT_LEN), seed);
  return out || `I can ${topic ?? "help"}.`;
}

export function genFriendlyQuestion(topic?: string) {
  const seed = topic ? topic.split(/\s+/).slice(0, ORDER - 1).join(" ") : undefined;
  const out = generateFromModel(MODEL, ORDER, Math.max(6, DEFAULT_LEN), seed);
  // ensure it ends with a question-like token
  if (out.endsWith("?")) return out;
  return out + "?";
}

export function genGreeting() {
  const out = generateFromModel(MODEL, ORDER, Math.max(6, DEFAULT_LEN));
  return out ? `Hello ${out.split(" ")[0]}! How can I help you?` : "Hello! How can I help you?";
}

export function genFarewell() {
  const out = generateFromModel(MODEL, ORDER, 6);
  return out ? `${out}.` : "Goodbye.";
}

export function genThanks() {
  const out = generateFromModel(MODEL, ORDER, 6);
  return out || "You're welcome.";
}
