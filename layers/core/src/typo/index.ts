import fs from "fs";
import path from "path";

export type TypoCorrection = {
  from: string;
  to: string;
};

export type TypoResult = {
  original: string;
  corrected: string;
  corrections: TypoCorrection[];
  reasoning: string;
};

type WordMap = {
  words: Set<string>;
  freq: Map<string, number>;
};

let wordMapPromise: Promise<WordMap> | null = null;

function findRepoRoot(startDir: string): string {
  let current = startDir;
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(current, "turbo.json"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return startDir;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

async function loadWordsFile(filePath: string, map: WordMap) {
  if (!fs.existsSync(filePath)) return;
  const raw = await fs.promises.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const word = line.trim().toLowerCase();
    if (!word) continue;
    map.words.add(word);
  }
}

async function loadWordsJson(filePath: string, map: WordMap) {
  if (!fs.existsSync(filePath)) return;
  const raw = await fs.promises.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, number>;
  for (const [key, value] of Object.entries(parsed)) {
    const word = key.trim().toLowerCase();
    if (!word) continue;
    map.words.add(word);
    if (typeof value === "number") {
      map.freq.set(word, value);
    }
  }
}

async function getWordMap(): Promise<WordMap> {
  if (!wordMapPromise) {
    wordMapPromise = (async () => {
      const map: WordMap = { words: new Set<string>(), freq: new Map() };
      const repoRoot = findRepoRoot(process.cwd());
      const base = path.join(repoRoot, "layers", "data", "words");
      await loadWordsFile(path.join(base, "words_alpha.txt"), map);
      await loadWordsFile(path.join(base, "words.txt"), map);
      await loadWordsJson(path.join(base, "words_dictionary.json"), map);
      return map;
    })();
  }
  return wordMapPromise;
}

function edits1(word: string): Set<string> {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const results = new Set<string>();
  for (let i = 0; i < word.length; i += 1) {
    results.add(word.slice(0, i) + word.slice(i + 1));
  }
  for (let i = 0; i < word.length - 1; i += 1) {
    results.add(word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2));
  }
  for (let i = 0; i < word.length; i += 1) {
    for (const ch of alphabet) {
      results.add(word.slice(0, i) + ch + word.slice(i + 1));
    }
  }
  for (let i = 0; i <= word.length; i += 1) {
    for (const ch of alphabet) {
      results.add(word.slice(0, i) + ch + word.slice(i));
    }
  }
  return results;
}

function pickBest(candidates: Iterable<string>, map: WordMap): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const cand of candidates) {
    if (!map.words.has(cand)) continue;
    const score = map.freq.get(cand) ?? 1;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}

function applyCase(original: string, corrected: string): string {
  if (original.toUpperCase() === original) return corrected.toUpperCase();
  if (original[0]?.toUpperCase() === original[0]) {
    return corrected[0]?.toUpperCase() + corrected.slice(1);
  }
  return corrected;
}

export async function resolveTypos(text: string): Promise<TypoResult> {
  const map = await getWordMap();
  const corrections: TypoCorrection[] = [];
  const corrected = text.replace(/[A-Za-z]+/g, (token) => {
    const lower = token.toLowerCase();
    if (lower.length <= 2) return token;
    if (map.words.has(lower)) return token;
    const best = pickBest(edits1(lower), map);
    if (!best) return token;
    const fixed = applyCase(token, best);
    if (fixed !== token) {
      corrections.push({ from: token, to: fixed });
    }
    return fixed;
  });

  const reasoning = corrections.length
    ? `Applied typo fixes: ${corrections.map((c) => `${c.from}->${c.to}`).join(", ")}.`
    : "No typos detected.";

  return {
    original: text,
    corrected: decodeEntities(corrected),
    corrections,
    reasoning,
  };
}
