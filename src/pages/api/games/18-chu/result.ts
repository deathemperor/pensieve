import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { ulid } from "../../../../lib/portraits/ulid";
import { isValidDay } from "../../../../lib/18chu/day";

export const prerender = false;

type D1 = import("@cloudflare/workers-types").D1Database;
const db = () => (env as any).DB as D1;

/** Fewest submissions before a percentile is meaningful rather than noise. */
const MIN_SAMPLE = 20;

/** GET ?day=YYYY-MM-DD → how many runs were submitted for that day. */
export const GET: APIRoute = async ({ request }) => {
	const url = new URL(request.url);
	const day = url.searchParams.get("day") ?? "";
	if (!isValidDay(day)) return json({ error: "bad_day" }, 400);
	const row = await db()
		.prepare("SELECT COUNT(*) AS n FROM game_18chu_results WHERE day = ?")
		.bind(day)
		.first<{ n: number }>();
	return json({ count: row?.n ?? 0 });
};

/** POST { day, score, timeMs } → record a run, return its standing.
 *  Scores are trusted; the percentile is honestly framed as "of scores
 *  submitted", never "of players". */
export const POST: APIRoute = async ({ request }) => {
	let body: { day?: string; score?: number; timeMs?: number };
	try {
		body = await request.json();
	} catch {
		return json({ error: "bad_json" }, 400);
	}
	const { day } = body;
	const score = Number(body.score);
	const timeMs = Number(body.timeMs);
	if (!day || !isValidDay(day)) return json({ error: "bad_day" }, 400);
	if (!Number.isInteger(score) || score < 0 || score > 18) return json({ error: "bad_score" }, 400);
	if (!Number.isInteger(timeMs) || timeMs < 0 || timeMs > 24 * 60 * 60 * 1000)
		return json({ error: "bad_time" }, 400);

	const d = db();
	await d
		.prepare(
			"INSERT INTO game_18chu_results (id, day, score, time_ms, created_at) VALUES (?, ?, ?, ?, ?)",
		)
		.bind(ulid(), day, score, timeMs, new Date().toISOString())
		.run();

	const stats = await d
		.prepare(
			"SELECT COUNT(*) AS total, SUM(CASE WHEN score > ? THEN 1 ELSE 0 END) AS above FROM game_18chu_results WHERE day = ?",
		)
		.bind(score, day)
		.first<{ total: number; above: number }>();

	const total = stats?.total ?? 1;
	const above = stats?.above ?? 0;
	// "Top X% of scores submitted today" — smaller is better; a leading score is Top 1%.
	// Below MIN_SAMPLE a percentile is noise: the only submitter of a 0/18 would
	// otherwise be told they're "Top 1%". Report the raw count instead.
	const topPercent =
		total >= MIN_SAMPLE ? Math.max(1, Math.round((above / total) * 100)) : null;

	return json({ ok: true, count: total, topPercent });
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
	});
}
