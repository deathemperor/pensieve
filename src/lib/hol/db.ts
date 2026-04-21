/// <reference types="@cloudflare/workers-types" />
// src/lib/hol/db.ts
//
// Accessor for the HOL_DB binding on Cloudflare Workers.
// In Astro v6, use import { env } from "cloudflare:workers" directly.
import { env } from "cloudflare:workers";

export function getHolDb(): D1Database {
  if (!env.HOL_DB) {
    throw new Error(
      "HOL_DB binding is not available. Check wrangler.jsonc and run wrangler.",
    );
  }
  return env.HOL_DB as D1Database;
}
