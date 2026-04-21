/// <reference types="@cloudflare/workers-types" />
// src/lib/hol/db.ts
//
// Accessor for the HOL_DB binding on Cloudflare Workers.
// Astro SSR on @astrojs/cloudflare exposes runtime bindings via
// Astro.locals.runtime.env.
import type { APIContext } from "astro";

export function getHolDb(locals: APIContext["locals"]): D1Database {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (locals as any).runtime?.env;
  if (!env?.HOL_DB) {
    throw new Error(
      "HOL_DB binding is not available. Check wrangler.jsonc and run wrangler.",
    );
  }
  return env.HOL_DB as D1Database;
}
