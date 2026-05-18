export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export async function basicSearch(
  query: string,
  options: { endpoint?: string; maxResults?: number } = {},
): Promise<SearchResult[]> {
  const maxResults = options.maxResults ?? 3;
  const baseEndpoint =
    options.endpoint ??
    process.env.DITROY_SEARCH_ENDPOINT ??
    "https://html.duckduckgo.com/html/";
  const endpoint = `${baseEndpoint}?q=${encodeURIComponent(query)}`;

  const res = await fetch(endpoint, {
    headers: {
      "User-Agent": "DITroy/1.0 (+https://example.local)",
      Accept: "text/html",
    },
  });

  if (!res.ok) return [];
  const html = await res.text();
  const results: SearchResult[] = [];

  const linkRegex =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g;
  const snippetRegex =
    /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>(.*?)<\/div>/g;

  const links = Array.from(html.matchAll(linkRegex));
  const snippets = Array.from(html.matchAll(snippetRegex));

  for (let i = 0; i < links.length && results.length < maxResults; i += 1) {
    const url = decodeEntities(links[i]?.[1] ?? "");
    const title = decodeEntities(stripHtml(links[i]?.[2] ?? ""));
    const snippetRaw = snippets[i]?.[1] ?? snippets[i]?.[2] ?? "";
    const snippet = decodeEntities(stripHtml(snippetRaw));
    if (!url || !title) continue;
    results.push({ title, url, snippet });
  }

  return results;
}
