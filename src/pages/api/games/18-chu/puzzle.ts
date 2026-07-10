import type { APIRoute } from "astro";
import { buildPuzzle, type Puzzle } from "../../../../lib/18chu/generate";
import { isValidDay, todayVN } from "../../../../lib/18chu/day";

export const prerender = false;

const MODES = new Set(["daily", "practice", "relax"]);

export const GET: APIRoute = async ({ request }) => {
	const url = new URL(request.url);
	const mode = (url.searchParams.get("mode") ?? "daily") as Puzzle["mode"];
	if (!MODES.has(mode)) return json({ error: "bad_mode" }, 400);

	let day: string;
	let seed: string;
	if (mode === "daily") {
		day = url.searchParams.get("day") ?? todayVN();
		if (!isValidDay(day)) return json({ error: "bad_day" }, 400);
		seed = day; // one shared puzzle per calendar day
	} else {
		day = todayVN();
		// practice/relax: a caller-supplied seed is reproducible & shareable;
		// otherwise mint a fresh one.
		seed =
			url.searchParams.get("seed")?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) ||
			crypto.randomUUID().slice(0, 12);
	}

	const puzzle = await buildPuzzle(day, mode, seed);

	// Daily puzzles are immutable for the day → cacheable at the edge.
	// Practice/relax are per-seed and cheap → don't fill the cache with them.
	const cache =
		mode === "daily"
			? "public, max-age=300, s-maxage=86400"
			: "private, no-store";
	return json(puzzle, 200, cache);
};

function json(body: unknown, status = 200, cache = "private, no-store") {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": cache },
	});
}
