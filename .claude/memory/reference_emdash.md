---
name: EmDash CMS reference
description: Cloudflare's Astro-based CMS (WordPress successor), v0.1 preview launched April 2026 — key facts and links
type: reference
originSessionId: 05f762e5-cde9-4725-9a83-729b7ab4f95f
---
EmDash is Cloudflare's open-source, AI-native CMS positioned as the "spiritual successor to WordPress." Launched v0.1 preview in early April 2026. Built on Astro, written in TypeScript, MIT licensed.

**Primary sources:**
- Launch blog post: https://blog.cloudflare.com/emdash-wordpress/
- GitHub monorepo: https://github.com/emdash-cms/emdash
- Templates repo: https://github.com/emdash-cms/templates

**Bootstrap:** `npm create emdash@latest` (scaffolder). Three official starter templates: blog, marketing, portfolio. Blog template has categories, tags, full-text search, RSS out of the box.

**Monorepo layout (relevant packages):**
- `packages/core` — Astro integration, APIs, admin UI, CLI
- `packages/cloudflare` — D1, R2, Worker Loader adapters
- `packages/auth` — auth library
- `packages/blocks` — Portable Text block definitions
- `packages/plugins` — first-party plugins

**Content model:** database-driven, NOT file/markdown-based. Portable Text (structured JSON), edited via TipTap in the admin UI. Portable across SQLite / D1 / Turso / PostgreSQL via Kysely. S3-compatible for storage. Generate TS types with `npx emdash types`.

**Cloudflare bindings used in a default wrangler.jsonc:** D1 (database), R2 (media/assets), KV (sessions), `worker_loaders` (sandboxed plugin execution — paid Workers accounts only; comment out to disable plugins).

**Paid-account constraint (load-bearing):** EmDash plugins depend on Dynamic Workers, which are paid-only ($5/mo Workers plan minimum). Free tier = no plugins = no Agent Skills / MCP-driven automation. Sites that want the full AI-native feature set must be on a paid plan. Confirmed in GitHub README as of April 2026.

**Theming:** themes are Astro projects (pages, layouts, components, styles, seed JSON). Themes cannot perform database operations (unlike WordPress). **Themes are site-wide, not per-collection** — per-category visual variation must be implemented as layout branching inside a single theme.

**AI / plugin model:** Agent Skills declare capabilities plugins can request (e.g. `read:content`, `email:send`) in manifests. Plugins run sandboxed via Worker Loaders. Built-in MCP server. Manifest-declared permissions are enforced — plugins can only do what they declare.

**Useful built-in converter:** `@emdash-cms/blocks` ships a `gutenberg-to-portable-text` converter. Relevant when building custom content-format converters (e.g. Facebook post → Portable Text) — crib its shape rather than writing Portable Text JSON generation from scratch.

**Astro integration pattern:** `import emdash from "emdash/astro"; import { d1 } from "emdash/db"; integrations: [emdash({ database: d1() })]`. Admin panel path: `/_emdash/admin` (local dev) / `/emdash/admin` (some docs differ — verify). Query pattern: `const { entries } = await getEmDashCollection("posts")` via Astro Live Collections API.

**Version note:** 0.1 is a preview/beta as of April 2026. Capabilities may evolve quickly — verify against the blog post and GitHub README before relying on any specific behavior for load-bearing design decisions.
