import * as fs from "fs";
import * as path from "path";

export type Model = Map<string, Record<string, number>>;

function tokenize(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\w\s'-]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function joinKey(tokens: string[]) {
  return tokens.join(" ");
}

export function buildModelFromText(text: string, order = 3): Model {
  const toks = tokenize(text);
  const model: Model = new Map();
  for (let i = 0; i + order <= toks.length; i++) {
    const prefix = toks.slice(i, i + order - 1);
    const next = toks[i + order - 1];
    const key = joinKey(prefix);
    const bucket = model.get(key) || {};
    bucket[next] = (bucket[next] || 0) + 1;
    model.set(key, bucket);
  }
  return model;
}

export function mergeModels(a: Model, b: Model) {
  for (const [k, v] of b.entries()) {
    const bucket = a.get(k) || {};
    for (const [word, cnt] of Object.entries(v)) {
      bucket[word] = (bucket[word] || 0) + cnt;
    }
    a.set(k, bucket);
  }
  return a;
}

export function weightedPick(bucket: Record<string, number>) {
  const entries = Object.entries(bucket);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  let r = Math.random() * total;
  for (const [w, c] of entries) {
    r -= c;
    if (r <= 0) return w;
  }
  return entries[entries.length - 1]?.[0] || "";
}

export function generateFromModel(model: Model, order = 3, maxWords = 12, seed?: string) {
  // choose seed: either provided or random key
  const keys = Array.from(model.keys()).filter(Boolean);
  if (!keys.length) return "";
  let key = seed && model.has(seed) ? seed : keys[Math.floor(Math.random() * keys.length)];
  const parts = key.split(" ").filter(Boolean);
  while (parts.length < order - 1) parts.unshift("");

  const out = [...parts];
  for (let i = 0; i < maxWords; i++) {
    const k = joinKey(out.slice(- (order - 1)));
    const bucket = model.get(k);
    if (!bucket) break;
    const next = weightedPick(bucket);
    out.push(next);
  }
  return out.filter(Boolean).join(" ");
}

export function buildModelFromRepoFiles(order = 3) {
  const files = [
    path.resolve(process.cwd(), "README.md"),
    path.resolve(process.cwd(), "roadmap.md"),
    path.resolve(process.cwd(), "DITroy_structure_plan.md"),
  ];
  let model: Model = new Map();
  for (const f of files) {
    try {
      const t = fs.readFileSync(f, "utf8");
      const m = buildModelFromText(t, order);
      model = mergeModels(model, m);
    } catch {
      // ignore missing files
    }
  }
  return model;
}
