#!/usr/bin/env -S node --import tsx
/**
 * promote-candidates: reads Chronicle candidates from stdin (NDJSON
 * produced by ingest-gmaps.ts), cross-references visited-cities.json
 * for city names, selects the highest-signal ones, and writes a seed
 * file fragment to stdout containing draft Chronicle entries an admin
 * can paste into seed/seed.json.
 *
 * Selection rules (high-signal = more likely to be a real event):
 *   1. Only include places visited exactly once (visits_seen === 1)
 *      — routine haunts are already filtered upstream at 8, this
 *      tightens to "one-off destinations".
 *   2. Duration must be >= 180 minutes (3 hours) — day-trip or longer.
 *   3. Drop entries in the user's top-5 visited cities (they're at
 *      home / commute range).
 *   4. Keep at most N per year (default 2) so one year doesn't dominate.
 *
 * Output is a JSON5-ish fragment with status="draft" so the entries
 * land in admin but don't appear on the public page until promoted.
 */

import { readFileSync } from "node:fs";
import type { GmapsVisitCandidate } from "../../src/utils/takeoutGmaps.js";

interface VisitedCell {
	id: string;
	lat: number;
	lng: number;
	visits: number;
	city: string | null;
	country: string | null;
	firstDate: string;
}

interface DraftEntry {
	id: string;
	slug: string;
	status: "draft";
	data: {
		title: string;
		title_en: string;
		title_vi: string;
		subtitle_en: string;
		subtitle_vi: string;
		event_date: string;
		date_precision: "day";
		category: "travel";
		location: string;
		source: "google-maps";
		source_id: string;
		visibility: "public";
	};
}

async function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (c) => { data += c; });
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", reject);
	});
}

function parseCandidates(raw: string): GmapsVisitCandidate[] {
	const out: GmapsVisitCandidate[] = [];
	for (const line of raw.split("\n")) {
		const t = line.trim();
		if (!t) continue;
		try { out.push(JSON.parse(t)); } catch { /* skip */ }
	}
	return out;
}

function cityLookup(cells: VisitedCell[]): (lat: number, lng: number) => { city: string | null; country: string | null } {
	return (lat, lng) => {
		let best: VisitedCell | null = null;
		let bestDist = Infinity;
		for (const c of cells) {
			const dx = c.lat - lat;
			const dy = c.lng - lng;
			const d = dx * dx + dy * dy;
			if (d < bestDist) { bestDist = d; best = c; }
		}
		return { city: best?.city ?? null, country: best?.country ?? null };
	};
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const perYear = Number(argv.find((_, i, a) => a[i - 1] === "--per-year")) || 2;

	const raw = await readStdin();
	const candidates = parseCandidates(raw);
	if (candidates.length === 0) {
		process.stderr.write("no candidates on stdin\n");
		process.exit(1);
	}

	let citiesData: { cells: VisitedCell[] } = { cells: [] };
	try {
		citiesData = JSON.parse(readFileSync("src/data/visited-cities.json", "utf8"));
	} catch { /* non-fatal — candidates still get emitted without city names */ }
	const cells = citiesData.cells ?? [];
	const topFiveIds = new Set(
		cells.slice(0).sort((a, b) => b.visits - a.visits).slice(0, 5).map((c) => c.id),
	);
	const lookup = cityLookup(cells);

	const byYear = new Map<number, GmapsVisitCandidate[]>();
	for (const c of candidates) {
		if (c.visits_seen !== 1) continue;
		if (c.visit_duration_minutes < 180) continue;
		// Derive the cell id the same way aggregateVisitedCities does.
		const cellLat = Math.floor(c.place_lat / 0.25) * 0.25;
		const cellLng = Math.floor(c.place_lng / 0.25) * 0.25;
		const cellId = `${cellLat.toFixed(2)}_${cellLng.toFixed(2)}`;
		if (topFiveIds.has(cellId)) continue;
		const y = c.first_visit_year;
		if (!byYear.has(y)) byYear.set(y, []);
		byYear.get(y)!.push(c);
	}

	const selected: GmapsVisitCandidate[] = [];
	for (const list of byYear.values()) {
		list.sort((a, b) => b.visit_duration_minutes - a.visit_duration_minutes);
		for (const c of list.slice(0, perYear)) selected.push(c);
	}
	selected.sort((a, b) => a.iso_date.localeCompare(b.iso_date));

	const drafts: DraftEntry[] = selected.map((c) => {
		const { city, country } = lookup(c.place_lat, c.place_lng);
		const placeLabel = city ? `${city}${country ? ", " + country : ""}` : `${c.place_lat}, ${c.place_lng}`;
		const enTitle = `Visit to ${placeLabel}`;
		const viTitle = `Ghé ${placeLabel}`;
		const slug = `gmaps-${c.source_id.toLowerCase().replace(/[^a-z0-9]+/g, "")}-${c.iso_date}`;
		const locJson = JSON.stringify({
			name: city ?? null,
			city: city ?? null,
			country: country ?? null,
			lat: c.place_lat,
			lng: c.place_lng,
		});
		return {
			id: slug,
			slug,
			status: "draft",
			data: {
				title: enTitle,
				title_en: enTitle,
				title_vi: viTitle,
				subtitle_en: `~${Math.round(c.visit_duration_minutes / 60)}h on ${c.iso_date}`,
				subtitle_vi: `~${Math.round(c.visit_duration_minutes / 60)} tiếng vào ${c.iso_date}`,
				event_date: c.iso_date,
				date_precision: "day",
				category: "travel",
				location: locJson,
				source: "google-maps",
				source_id: c.source_id,
				visibility: "public",
			},
		};
	});

	process.stderr.write(`▸ ${candidates.length} candidates → ${drafts.length} drafts\n`);
	process.stdout.write(JSON.stringify(drafts, null, "\t") + "\n");
}

main().catch((err) => {
	process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
	process.exit(1);
});
