// App-level rate limiter. Fixed window per (bucket_key, window_start) row.
// D1-backed: one row per key-window, incremented on each hit. Expired
// windows are filtered by WHERE window_start >= ? on check, and
// periodically swept by the hourly cron (see src/worker.ts).

import type { D1Database } from "@cloudflare/workers-types";

export interface RateLimitSpec {
  budget: number;        // max hits allowed per window
  windowSeconds: number; // window length
}

// ─────────────────────────────────────────────────────────────
// TODO: per-endpoint budgets. Tune these to your actual usage.
//
// Defaults are conservative. Meaningful choices:
//   - enrich      : 1 query/day/contact costs 1 of your Google CSE free tier
//                   (100/day). Keep headroom for manual reruns.
//   - ingest      : external systems (openclaw + iOS Shortcut) — can burst.
//   - outreach    : should be LOW — email sends are real money + spam risk.
//   - drive_scan  : hourly cron + occasional manual — 10/hr is plenty.
// ─────────────────────────────────────────────────────────────
export const LIMITS: Record<string, RateLimitSpec> = {
  enrich:     { budget: 30,  windowSeconds: 3600 },  // 30/hour
  ingest:     { budget: 120, windowSeconds: 60 },    // 120/minute per bearer
  outreach:   { budget: 20,  windowSeconds: 3600 },  // 20/hour (email sends)
  drive_scan: { budget: 10,  windowSeconds: 3600 },  // 10/hour
};

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: string;       // ISO
  retryAfterSeconds: number;
}

/**
 * Atomically increment the bucket and check the budget. Returns ok=false
 * when the window is exhausted. The caller should return 429 + Retry-After.
 *
 * Bucket key shape: "<endpoint>:<identity>" where identity is an email for
 * admin-gated endpoints or a bearer-token hash for public-ingest endpoints.
 */
export async function rateLimit(
  db: D1Database,
  endpoint: keyof typeof LIMITS,
  identity: string,
): Promise<RateLimitResult> {
  const spec = LIMITS[endpoint];
  const now = Math.floor(Date.now() / 1000);
  const windowStartSec = now - (now % spec.windowSeconds);
  const windowStart = new Date(windowStartSec * 1000).toISOString();
  const resetAt = new Date((windowStartSec + spec.windowSeconds) * 1000).toISOString();
  const key = `${endpoint}:${identity}`;

  // Upsert + atomic increment.
  await db
    .prepare(`
      INSERT INTO rate_limit_buckets (bucket_key, window_start, count)
      VALUES (?, ?, 1)
      ON CONFLICT(bucket_key, window_start) DO UPDATE SET count = count + 1
    `)
    .bind(key, windowStart)
    .run();

  const row = await db
    .prepare("SELECT count FROM rate_limit_buckets WHERE bucket_key = ? AND window_start = ?")
    .bind(key, windowStart)
    .first<{ count: number }>();
  const count = row?.count ?? 1;

  const remaining = Math.max(0, spec.budget - count);
  const ok = count <= spec.budget;
  const retryAfterSeconds = ok ? 0 : Math.max(1, (windowStartSec + spec.windowSeconds) - now);

  return { ok, remaining, resetAt, retryAfterSeconds };
}

/** Hash a bearer token to a short opaque identity for bucket keys. */
export async function hashBearer(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const hex = Array.from(new Uint8Array(buf).slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `b_${hex}`;
}

/** Build a 429 Response with the standard Retry-After header. */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: "rate_limited", retry_after: result.retryAfterSeconds, reset_at: result.resetAt }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Reset": result.resetAt,
      },
    },
  );
}
