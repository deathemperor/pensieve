import type { KVNamespace } from "@cloudflare/workers-types";

export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const kvKey = `wc-rl:${key}:${bucket}`;

  const raw = await kv.get(kvKey);
  const current = raw !== null ? (Number(raw) || 0) : 0;

  if (current >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await kv.put(kvKey, String(current + 1), { expirationTtl: windowSec * 2 });
  return { allowed: true, remaining: limit - current - 1 };
}
