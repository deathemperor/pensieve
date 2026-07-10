import type { APIRoute } from "astro";
import { revealLetter, type Puzzle } from "../../../../lib/18chu/generate";
import { isValidDay, todayVN } from "../../../../lib/18chu/day";

export const prerender = false;

const MODES = new Set(["daily", "practice", "relax"]);

export const GET: APIRoute = async ({ request }) => {
	const url = new URL(request.url);
	const mode = (url.searchParams.get("mode") ?? "daily") as Puzzle["mode"];
	if (!MODES.has(mode)) return json({ error: "bad_mode" }, 400);

	// Reconstruct the same seed the puzzle route used.
	let seed: string;
	if (mode === "daily") {
		const day = url.searchParams.get("day") ?? todayVN();
		if (!isValidDay(day)) return json({ error: "bad_day" }, 400);
		seed = day;
	} else {
		seed = (url.searchParams.get("seed") ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
		if (!seed) return json({ error: "seed_required" }, 400);
	}

	const word = Number(url.searchParams.get("word"));
	const pos = Number(url.searchParams.get("pos"));
	if (!Number.isInteger(word) || word < 0 || word > 17) return json({ error: "bad_word" }, 400);
	if (!Number.isInteger(pos) || pos < 0) return json({ error: "bad_pos" }, 400);

	const letter = revealLetter(mode, seed, word, pos);
	if (letter === null) return json({ error: "out_of_range" }, 400);
	return json({ letter });
};

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
	});
}
