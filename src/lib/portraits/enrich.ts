// Google Custom Search JSON API client for newspaper-mention enrichment.
// 100 free queries/day; set GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID via wrangler secret.

export interface GoogleCseResult {
  title: string;
  url: string;
  source: string;         // e.g. "nytimes.com"
  snippet: string;
  published_at: string | null;  // ISO-8601 if the article metadata had it
}

export type EnrichResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

interface CseItem {
  title?: string;
  link?: string;
  displayLink?: string;
  snippet?: string;
  pagemap?: {
    metatags?: Array<Record<string, string | undefined>>;
    newsarticle?: Array<Record<string, string | undefined>>;
  };
}

function extractPublishedAt(item: CseItem): string | null {
  const metas = item.pagemap?.metatags?.[0] ?? {};
  const news = item.pagemap?.newsarticle?.[0] ?? {};
  const candidates = [
    metas["article:published_time"],
    metas["og:article:published_time"],
    metas["published_time"],
    metas["pubdate"],
    metas["date"],
    news["datepublished"],
  ];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

export function buildQuery(fullName: string, company: string | null): string {
  // Quote the full name so Google prefers phrase matches.
  const parts: string[] = [`"${fullName}"`];
  if (company && company.trim()) parts.push(`"${company.trim()}"`);
  return parts.join(" ");
}

export async function searchGoogleCse(
  apiKey: string,
  cseId: string,
  query: string,
  num = 10,
): Promise<EnrichResult<GoogleCseResult[]>> {
  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: String(Math.min(Math.max(num, 1), 10)),
  });

  let res: Response;
  try {
    res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
  } catch (e) {
    return { ok: false, error: `network: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `cse_api_${res.status}: ${txt.slice(0, 300)}` };
  }

  let body: { items?: CseItem[] };
  try { body = await res.json() as { items?: CseItem[] }; }
  catch { return { ok: false, error: "invalid_json" }; }

  const items = body.items ?? [];
  const out: GoogleCseResult[] = [];
  for (const item of items) {
    if (!item.link || !item.title) continue;
    out.push({
      title: item.title,
      url: item.link,
      source: item.displayLink ?? new URL(item.link).hostname,
      snippet: item.snippet ?? "",
      published_at: extractPublishedAt(item),
    });
  }
  return { ok: true, value: out };
}
