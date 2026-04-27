import handler from "@astrojs/cloudflare/entrypoints/server";
import { nextBirthdayOccurrence } from "./lib/portraits/reminders";
import { ulid as portraitsUlid } from "./lib/portraits/ulid";
export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

/**
 * Custom worker wrapping the Astro handler.
 *
 * With base: "/" Astro owns the entire domain. The worker only
 * intercepts routes that need special handling:
 *   /plant-gallery/*  → static assets (outside Astro)
 *   /pensieve/m/*     → R2 media proxy, 1-year cache
 *   /trương           → 301 redirect to canonical /Trương
 *   everything else   → Astro
 */
export default {
	async fetch(request: Request, env: any, ctx: any) {
		const url = new URL(request.url);
		const path = url.pathname;

		// Plant gallery — static assets outside Astro
		if (path === "/plant-gallery" || path === "/plant-gallery/") {
			return env.ASSETS.fetch(
				new Request(new URL("/plant-gallery/index.html", url), request),
			);
		}
		if (path.startsWith("/plant-gallery/")) {
			return env.ASSETS.fetch(request);
		}

		// R2 media proxy for Pensieve
		const mediaPrefix = "/pensieve/m/";
		if (path.startsWith(mediaPrefix) && env.MEDIA) {
			const key = path.slice(mediaPrefix.length);
			if (!/^[a-z0-9]+\.(jpg|jpeg|png|webp|gif)$/i.test(key)) {
				return new Response("Invalid media key", { status: 400 });
			}
			const obj = await env.MEDIA.get(`media/${key}`);
			if (!obj) {
				return new Response("Not found", { status: 404 });
			}
			return new Response(obj.body, {
				headers: {
					"Content-Type":
						obj.httpMetadata?.contentType ||
						(key.endsWith(".jpg") || key.endsWith(".jpeg")
							? "image/jpeg"
							: key.endsWith(".png")
								? "image/png"
								: "application/octet-stream"),
					"Cache-Control": "public, max-age=31536000, immutable",
					"Access-Control-Allow-Origin": "*",
				},
			});
		}

		// EmDash admin content list with limit>50 exceeds Worker CPU time
		// when there are 200+ posts (SEO + byline hydration is O(n)).
		if (
			path.startsWith("/_emdash/api/content/") &&
			!path.includes("/trash")
		) {
			const limit = url.searchParams.get("limit");
			if (limit && parseInt(limit) > 50) {
				url.searchParams.set("limit", "50");
				return handler.fetch(new Request(url.href, request), env, ctx);
			}
		}

		// Lowercase /trương → canonical /Trương. Hardcode origin
		// so the redirect target is structurally anchored to huuloc.com —
		// no attacker input can steer it cross-origin.
		if (path.startsWith("/tr\u01B0\u01A1ng")) {
			const tail = path.slice("/tr\u01B0\u01A1ng".length);
			// Hardcoded origin + path-only tail — cannot resolve cross-origin.
			// nosemgrep
			return Response.redirect(`https://huuloc.com/Tr\u01B0\u01A1ng${tail}${url.search}`, 301); // nosemgrep
		}

		// Profile aliases: /deathemperor and /Truong (ASCII, no diacritics)
		// serve the SAME content as /Tr\u01B0\u01A1ng without a browser-
		// visible redirect. The URL bar stays as the visitor typed; the
		// worker rewrites the inbound request to the canonical Astro route
		// so /Tr\u01B0\u01A1ng.astro renders. <link rel="canonical"> in
		// Base.astro tells search engines the real URL, so SEO collapses
		// the aliases. Folding the rewrite into the cache key below also
		// means /deathemperor and /Tr\u01B0\u01A1ng share one cache slot per
		// language — no duplicate origin renders.
		const aliasMatch = path.match(/^\/(deathemperor|truong)(\/.*)?$/i);
		const aliasedPath = aliasMatch ? `/Tr\u01B0\u01A1ng${aliasMatch[2] ?? ""}` : path;
		const downstreamRequest = aliasMatch
			? new Request(new URL(`${aliasedPath}${url.search}`, url.origin).toString(), request)
			: request;

		// Everything else → Astro, with edge caching applied per the
		// Cache-Control header set by setCachePolicy() in page frontmatter.
		// Workers responses are NOT auto-cached on a custom domain — we
		// have to drive caches.default ourselves. We fold the resolved
		// language into the cache key (instead of relying on Vary, which
		// caches.default ignores) so VI and EN serve from separate slots.
		if (request.method === "GET" && !aliasedPath.startsWith("/_emdash") && !aliasedPath.startsWith("/api/")) {
			const cookie = request.headers.get("cookie") || "";
			const cookieLang = cookie.match(/(?:^|;\s*)pref_lang=(vi|en)\b/)?.[1];
			const accept = (request.headers.get("accept-language") || "").toLowerCase();
			const acceptLang = accept.startsWith("vi") || accept.includes(",vi") ? "vi" : "en";
			const lang = cookieLang ?? acceptLang;

			// Cache key is built off the canonical (post-rewrite) URL so
			// /deathemperor and /Tr\u01B0\u01A1ng share cache entries.
			const keyUrl = new URL(downstreamRequest.url);
			keyUrl.searchParams.set("__lang", lang);
			const cacheKey = new Request(keyUrl.toString(), { method: "GET" });

			const cache = caches.default;
			const cached = await cache.match(cacheKey);
			if (cached) {
				// Re-emit the response so we can stamp X-Cache. caches.default
				// hits don't carry cf-cache-status because Workers bypass the
				// transparent HTML cache layer.
				const hit = new Response(cached.body, cached);
				hit.headers.set("x-cache", "HIT");
				return hit;
			}

			const response = await handler.fetch(downstreamRequest, env, ctx);
			const cc = response.headers.get("cache-control") ?? "";
			// Only cache success responses that explicitly opted in via
			// `public` + a max-age/s-maxage hint. CF refuses to cache
			// responses carrying a Set-Cookie, so strip those before put.
			if (response.status === 200 && /\bpublic\b/i.test(cc) && /\b(s-maxage|max-age)=\d+/i.test(cc)) {
				const cacheable = new Response(response.body, response);
				cacheable.headers.delete("set-cookie");
				cacheable.headers.set("x-cache", "MISS");
				ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));
				return cacheable;
			}
			response.headers.set("x-cache", "BYPASS");
			return response;
		}

		return handler.fetch(downstreamRequest, env, ctx);
	},

	async scheduled(event: ScheduledEvent, env: any, _ctx: ExecutionContext) {
		const db = env.DB;
		if (!db) return;

		// Every 5 min: incrementally sync every opted-in Google calendar
		// across all weasley-clock oauth_accounts. Runs inline here — no
		// HTTP hop / shared-secret dance needed because this handler has
		// full env access.
		if (event.cron === "*/5 * * * *") {
			try {
				const { syncAll } = await import("./lib/weasley-clock/sync-all");
				if (!env.OAUTH_ENC_KEY || !env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
					console.log("[cron] weasley-clock: OAuth env not configured, skipping");
					return;
				}
				const { summary } = await syncAll(db, {
					encKey: env.OAUTH_ENC_KEY,
					clientId: env.GOOGLE_OAUTH_CLIENT_ID,
					clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
				});
				console.log(`[cron] weasley-clock synced ${summary.length} calendars`);
			} catch (err) {
				console.error("[cron] weasley-clock failed:", err);
			}
			return;
		}

		// Every 10 min: send 24h reminder emails for upcoming confirmed bookings.
		if (event.cron === "*/10 * * * *") {
			try {
				if (!env.RESEND_API_KEY) {
					console.log("[cron] reminders: RESEND_API_KEY not set, skipping");
					return;
				}
				const { runReminderPass } = await import("./lib/weasley-clock/reminders");
				const result = await runReminderPass({ db, resendApiKey: env.RESEND_API_KEY });
				console.log(`[cron] reminders: scanned=${result.scanned} sent=${result.sent} errors=${result.errors}`);
			} catch (err: any) {
				console.error("[cron] reminders: exception:", err?.message ?? err);
			}
			return;
		}

		// Hourly: scan enabled Drive folders for new card images + sweep stale rate-limit rows.
		if (event.cron === "0 * * * *") {
			try {
				const { scanFolder } = await import("./pages/api/portraits/integrations/drive/scan");
				const rs = await db.prepare("SELECT folder_id FROM drive_scan_folders WHERE enabled = 1").all();
				for (const row of ((rs.results ?? []) as Array<{ folder_id: string }>)) {
					await scanFolder(env, row.folder_id, { limit: 100 });
				}
			} catch (err) {
				console.error("drive scan cron failed:", err);
			}
			// Rate-limit sweep: delete windows > 24h old (longest window spec is 1h, 24h is safe).
			try {
				const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
				await db.prepare("DELETE FROM rate_limit_buckets WHERE window_start < ?").bind(cutoff).run();
			} catch (err) {
				console.error("rate limit sweep failed:", err);
			}
			return;
		}

		const today = new Date();
		const todayKey = today.toISOString().slice(0, 10);

		// Claude-era GitHub stats: PR count + pre-squash commit sum across
		// every repo the token can see (owned + collaborator + org).
		// Cached in KV so /Trương renders instantly.
		try {
			if (env.GITHUB_TOKEN && env.SESSION) {
				const { aggregateClaudeEraStats } = await import("./lib/github-stats");
				const stats = await aggregateClaudeEraStats(env.GITHUB_TOKEN);
				await env.SESSION.put("stats:claude-era", JSON.stringify(stats));
			}
		} catch (err) {
			console.error("claude-era stats cron failed:", err);
		}

		const contactsWithBirthday = await db
			.prepare("SELECT id, birthday FROM contacts WHERE birthday IS NOT NULL AND deleted_at IS NULL AND is_placeholder=0")
			.all();
		for (const c of (contactsWithBirthday.results ?? []) as Array<{ id: string; birthday: string }>) {
			const next = nextBirthdayOccurrence(c.birthday, today);
			if (!next) continue;
			await db.prepare("DELETE FROM contact_reminders WHERE contact_id=? AND kind='birthday' AND dismissed_at IS NULL").bind(c.id).run();
			await db
				.prepare("INSERT INTO contact_reminders (id, contact_id, kind, due_at, recurring, body, created_at) VALUES (?,?,?,?,?,?,?)")
				.bind(portraitsUlid(), c.id, "birthday", next, "yearly", null, today.toISOString())
				.run();
		}

		const stale = await db
			.prepare(`
				SELECT c.id
				FROM contacts c
				LEFT JOIN contact_interactions i ON i.contact_id = c.id
				WHERE c.deleted_at IS NULL
					AND c.is_placeholder = 0
					AND c.prestige_tier IN ('S','A')
				GROUP BY c.id
				HAVING COALESCE(MAX(i.happened_at), '1970-01-01') < date('now', '-180 days')
			`)
			.all();
		for (const c of (stale.results ?? []) as Array<{ id: string }>) {
			const existing = await db.prepare("SELECT 1 FROM contact_reminders WHERE contact_id=? AND kind='follow_up' AND dismissed_at IS NULL").bind(c.id).first();
			if (existing) continue;
			await db
				.prepare("INSERT INTO contact_reminders (id, contact_id, kind, due_at, body, created_at) VALUES (?,?,?,?,?,?)")
				.bind(portraitsUlid(), c.id, "follow_up", todayKey, "Last contact > 6mo", today.toISOString())
				.run();
		}
	},
};
