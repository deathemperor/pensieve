---
name: Pensieve build decisions
description: User's confirmed choices for hosting, language handling, themes, and domain on the pensieve project
type: feedback
originSessionId: 05f762e5-cde9-4725-9a83-729b7ab4f95f
---
Four decisions locked in during the 2026-04-11 kickoff conversation:

1. **Hosting: Cloudflare Workers + D1 + R2 + KV (full EmDash native).** Not Cloudflare Pages static. User picked the native serverless path explicitly.
2. **Language: mixed Vietnamese + English.** Detect per-post, tag, classify independently, render both. Don't hardcode English-only heuristics for "long narrative" detection.
3. **Domain: `*.workers.dev` subdomain for now.** Swap to a real domain later. Don't block the plan on domain registration.
4. **Per-category visual themes.** User called out fish → natural pond theme, startup → rocket-science theme. They want creative, distinct visual treatments per category — this is a load-bearing aesthetic requirement, not a nice-to-have.

**Constraint discovered:** EmDash 0.1 themes are **site-wide**, not per-collection. So "different theme per category" cannot be a config toggle — it must be implemented as a layout-selection layer inside a single custom theme that branches on a post's category field. User was told this; proceed on that basis.

**Why:** user wants the AI-agent / MCP side of EmDash (rules out the Pages static path), has a bilingual audience, doesn't want domain bureaucracy blocking the first ship, and cares deeply about visual distinctiveness per topic — the category-themes idea was the most emphasized creative direction in the original prompt.

**How to apply:** any planning or implementation on pensieve should assume these four defaults without re-asking. If a future choice would contradict one of them (e.g., suggesting Pages for simplicity, or a single site-wide theme for speed), flag the tradeoff explicitly rather than silently overriding.
