export function decorate(
  response: string,
  options: { name?: string; tone?: string } = {},
) {
  const name = options.name || "DITroy";
  const tone = options.tone || "neutral";
  if (tone === "playful") return response + ` 😄 — ${name}`;
  if (tone === "warm") return response + ` ❤️ — ${name}`;
  return response + ` — ${name}`;
}
