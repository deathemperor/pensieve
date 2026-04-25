// Per-page Cloudflare/browser cache policy.
//
// Pre-existing reality: every public page on huuloc.com is fully SSR'd on
// every request — D1 + KV + GitHub fan-out per visitor. TTFB swings 0.6s
// to 2.7s because no Cache-Control is sent, so CF can't store the
// response. Pages aren't really dynamic; they only change when content is
// edited or a daily cron fires.
//
// This helper sets a sensible Cache-Control + Vary on the Astro response
// from a page's frontmatter. Each named policy encodes a triple:
//   • max-age (browser hold)
//   • s-maxage (Cloudflare edge hold)
//   • stale-while-revalidate (serve stale while a background re-fetch
//     warms the entry)
//
// Vary on Accept-Language + Cookie because pages rebrand per `pref_lang`
// cookie and Accept-Language header. CF caches separate copies per
// distinct value, which is the right behavior even at the cost of
// slightly diluted hit rate (only ~3 cookie variants per route in
// practice).
//
// Use the most relaxed policy a page can tolerate. If you'd be unhappy
// seeing N-second-old data on the page, use a lower bucket. If a page
// has zero live state (gh-stats reads from KV that the daily cron
// writes), use `static`.

import type { AstroGlobal } from "astro";

type Policy = "static" | "blog-index" | "doc" | "ror-hub";

interface PolicyValues {
	maxAge: number;
	sMaxAge: number;
	staleWhileRevalidate: number;
}

const POLICIES: Record<Policy, PolicyValues> = {
	// /Trương, /, /pensieve/chronicle — semi-static, refreshed by cron or rare edits.
	static: { maxAge: 60, sMaxAge: 3600, staleWhileRevalidate: 86400 },
	// Blog/wishlist/spec-list indexes — content updates a few times a day.
	"blog-index": { maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 3600 },
	// Single posts / chronicle entries / spec docs — cached aggressively;
	// stale-while-revalidate keeps freshness.
	doc: { maxAge: 300, sMaxAge: 3600, staleWhileRevalidate: 86400 },
	// /room-of-requirement hub — live task + wishlist counts; short TTL.
	"ror-hub": { maxAge: 30, sMaxAge: 120, staleWhileRevalidate: 600 },
};

export function setCachePolicy(astro: AstroGlobal, policy: Policy): void {
	const { maxAge, sMaxAge, staleWhileRevalidate } = POLICIES[policy];
	astro.response.headers.set(
		"Cache-Control",
		`public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
	);
	astro.response.headers.set("Vary", "Accept-Language, Cookie");
}
