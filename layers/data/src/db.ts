import { createClient } from "@supabase/supabase-js";
import { Redis } from "ioredis";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase credentials not found. DB sync will be skipped.");
}

// 1. Initialize Supabase
export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// 2. Initialize Redis Cache
export const redis = new Redis(redisUrl);

redis.on("error", (err: Error) => {
  console.warn("Redis connection error:", err.message);
});

/**
 * Checks Redis for a learned response.
 * Standardizing the cache key format.
 */
export type LearnedResponse = {
  response: string;
  intent: string;
  topic: string;
  reasoning: string;
};

export async function getCachedResponse(
  userInput: string,
): Promise<LearnedResponse | null> {
  const normalizedKey = userInput.trim().toLowerCase();
  try {
    const cached = await redis.get(`learned:${normalizedKey}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Partial<LearnedResponse>;
        if (parsed && typeof parsed.response === "string") {
          return {
            response: parsed.response,
            intent: parsed.intent ?? "custom",
            topic: parsed.topic ?? "custom",
            reasoning: parsed.reasoning ?? "Matched user's taught response in Cache.",
          };
        }
      } catch {
        return {
          response: cached,
          intent: "custom",
          topic: "custom",
          reasoning: "Matched user's taught response in Cache.",
        };
      }
    }
  } catch (e) {
    console.error("Cache read error", e);
  }
  return null;
}

/**
 * Saves a newly taught response to Supabase and caches it in Redis.
 */
export async function saveLearnedResponse(
  userInput: string,
  aiResponse: string,
  meta: Omit<LearnedResponse, "response">
) {
  const normalizedInput = userInput.trim();
  const normalizedKey = normalizedInput.toLowerCase();
  const payload: LearnedResponse = {
    response: aiResponse,
    intent: meta.intent,
    topic: meta.topic,
    reasoning: meta.reasoning,
  };

  // 1. Cache to Redis permanently (or set expiration if desired)
  try {
    await redis.set(`learned:${normalizedKey}`, JSON.stringify(payload));
  } catch (e) {
    console.error("Cache write error", e);
  }

  // 2. Persist to Supabase if configured
  if (supabase) {
    const { error } = await supabase.from("learned_responses").insert([
      {
        user_input: normalizedInput,
        response_text: aiResponse,
        intent: meta.intent,
        topic: meta.topic,
        reasoning: meta.reasoning,
      },
    ]);

    if (error) {
      console.error("Failed to save to Supabase:", error.message);
    }
  }
}
