# Cron wiring for plugin-weasley-clock

## EmDash API findings

EmDash plugins do **not** declare cron triggers themselves. Neither `plugin-pensieve-engage` nor `plugin-chronicle-scanner` use a `scheduled:` hook; their descriptors declare only `hooks`, `routes`, `storage`, and `capabilities`.

## Worker-level cron pattern

`wrangler.jsonc` already declares `triggers.crons` (currently `["0 23 * * *", "0 * * * *"]` for portraits' daily + hourly jobs). `src/worker.ts` has a `scheduled(event, env, ctx)` handler that dispatches on `event.cron`.

## Chosen approach

Add a new `*/5 * * * *` entry to `wrangler.jsonc`'s crons, then add a new branch in `src/worker.ts`' `scheduled()` handler. The branch fetches our plugin's `cron/sync-all` HTTP route with a `X-Sync-Secret` header so the route can auth the internal call without an admin session.

Plugin-side sync logic stays inside the sandbox; the worker is a thin dispatcher that invokes it via an internal HTTP call. Matches the pattern you'd use to self-invoke any authed route from a scheduled handler on Cloudflare Workers.

## Rationale

- Matches existing `scheduled()` dispatch pattern (no new infrastructure)
- Keeps sync logic inside the plugin (reusable for the admin Sync-now button via same route)
- Shared-secret auth is simpler than service bindings for a same-worker invocation
- Future cron additions (e.g. token-refresh heartbeat) can be new branches in the same dispatcher
