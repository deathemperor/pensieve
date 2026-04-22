import handler from "@astrojs/cloudflare/entrypoints/server";
import { nextBirthdayOccurrence } from "./lib/portraits/reminders";
import { ulid as portraitsUlid } from "./lib/portraits/ulid";
export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

/**
 * OpenClawContainer stub — the real implementation lives on worktree-Ron.
 * Prod has existing Durable Objects bound to this class name; removing the
 * export would require a destructive delete-class migration. This stub keeps
 * the export alive so deploys from main succeed without touching DO storage.
 * Safe to remove once worktree-Ron merges (or a delete-class migration runs).
 */
export class OpenClawContainer {
	constructor(_state: unknown, _env: unknown) {}
	async fetch() {
		return new Response("OpenClaw is not deployed on this branch.", { status: 503 });
	}
}

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

		// Lowercase /trương → canonical /Trương
		if (path.startsWith("/tr\u01B0\u01A1ng")) {
			const canonical = path.replace("/tr\u01B0\u01A1ng", "/Tr\u01B0\u01A1ng");
			return Response.redirect(new URL(canonical, url.origin).href, 301);
		}

		// Everything else → Astro
		return handler.fetch(request, env, ctx);
	},

	async scheduled(_event: ScheduledEvent, env: any, _ctx: ExecutionContext) {
		const db = env.DB;
		if (!db) return;

		const today = new Date();
		const todayKey = today.toISOString().slice(0, 10);

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
