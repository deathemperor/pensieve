#!/usr/bin/env -S node --import tsx
/**
 * build-visited-cities: read Google Timeline candidates from stdin (NDJSON
 * produced by ingest-gmaps.ts), grid-aggregate them into ~25km "city
 * cells", optionally reverse-geocode each cell via OpenStreetMap
 * Nominatim, and emit a single JSON document to stdout.
 *
 * Usage:
 *   npx tsx scripts/chronicle/ingest-gmaps.ts ~/Downloads/location-history.json \
 *     | npx tsx scripts/chronicle/build-visited-cities.ts \
 *     > src/data/visited-cities.json
 *
 * With reverse geocoding (slow — 1.5s per cell via Nominatim):
 *   ... | npx tsx scripts/chronicle/build-visited-cities.ts --geocode \
 *     > src/data/visited-cities.json
 *
 * Without --geocode, the output has `city = null` / `country = null` for
 * every cell; the Atlas still renders them with tooltips showing coords.
 *
 * Nominatim usage policy (required):
 *   - Max 1 request/sec. We sleep 1500ms between calls.
 *   - Must set a descriptive User-Agent. We use "pensieve-chronicle/0.1".
 *   - Not for bulk usage. Running once per export is fine; re-running
 *     without a cache is rude. We cache results under .session/nominatim-cache.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
	aggregateVisitedCities,
	type VisitedCellRaw,
} from "../../src/utils/aggregateVisitedCities.js";
import type { GmapsVisitCandidate } from "../../src/utils/takeoutGmaps.js";

interface CellOut extends VisitedCellRaw {
	city: string | null;
	country: string | null;
	display: string | null;
}

async function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => { data += chunk; });
		process.stdin.on("end", () => resolve(data));
		process.stdin.on("error", reject);
	});
}

function parseCandidates(raw: string): GmapsVisitCandidate[] {
	const out: GmapsVisitCandidate[] = [];
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			out.push(JSON.parse(trimmed));
		} catch {
			process.stderr.write(`skipping bad line: ${trimmed.slice(0, 60)}...\n`);
		}
	}
	return out;
}

const CACHE_PATH = ".session/nominatim-cache.json";
type CacheEntry = { city: string | null; country: string | null; display: string | null };
function loadCache(): Record<string, CacheEntry> {
	try { return JSON.parse(readFileSync(CACHE_PATH, "utf8")); } catch { return {}; }
}
function saveCache(cache: Record<string, CacheEntry>): void {
	mkdirSync(dirname(CACHE_PATH), { recursive: true });
	writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function reverseGeocodeOnce(lat: number, lng: number): Promise<CacheEntry> {
	// zoom=8 gives county/state-level names, which for Vietnam maps to
	// major-city "province" names like "Ho Chi Minh City" rather than ward.
	const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=8&accept-language=en`;
	const res = await fetch(url, {
		headers: {
			"User-Agent": "pensieve-chronicle/0.1 (https://huuloc.com)",
		},
	});
	if (!res.ok) {
		process.stderr.write(`nominatim ${res.status} for ${lat},${lng}\n`);
		return { city: null, country: null, display: null };
	}
	const data = await res.json() as { address?: Record<string, string>; display_name?: string };
	const a = data.address ?? {};
	const city = a.city ?? a.town ?? a.state ?? a.province ?? a.county ?? a.municipality ?? a.village ?? null;
	const country = a.country_code ? a.country_code.toUpperCase() : (a.country ?? null);
	return {
		city,
		country,
		display: data.display_name ?? null,
	};
}

async function reverseGeocode(lat: number, lng: number): Promise<CacheEntry> {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			return await reverseGeocodeOnce(lat, lng);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			process.stderr.write(`retry ${attempt + 1}/3 for ${lat},${lng}: ${msg}\n`);
			await sleep(3000 * (attempt + 1));
		}
	}
	return { city: null, country: null, display: null };
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const geocode = argv.includes("--geocode");

	const raw = await readStdin();
	const candidates = parseCandidates(raw);
	const cells = aggregateVisitedCities(candidates);

	process.stderr.write(`▸ ${candidates.length} candidates → ${cells.length} cells\n`);

	const cache = geocode ? loadCache() : {};
	const out: CellOut[] = [];

	for (let i = 0; i < cells.length; i++) {
		const cell = cells[i];
		let enriched: CacheEntry = { city: null, country: null, display: null };
		if (geocode) {
			const cached = cache[cell.id];
			if (cached) {
				enriched = cached;
			} else {
				try {
					enriched = await reverseGeocode(cell.lat, cell.lng);
					cache[cell.id] = enriched;
					// Save cache every 10 calls so a crash doesn't lose all progress.
					if (i % 10 === 0) saveCache(cache);
					await sleep(1500);
				} catch (err) {
					process.stderr.write(
						`geocode error at ${cell.id}: ${err instanceof Error ? err.message : String(err)}\n`,
					);
				}
			}
			process.stderr.write(
				`  [${i + 1}/${cells.length}] ${cell.id} → ${enriched.city ?? "(unknown)"}, ${enriched.country ?? "??"}\n`,
			);
		}
		out.push({ ...cell, ...enriched });
	}
	if (geocode) saveCache(cache);

	process.stdout.write(JSON.stringify(
		{
			generated_at: new Date().toISOString(),
			cell_degrees: 0.25,
			total_cells: out.length,
			cells: out,
		},
		null,
		"\t",
	) + "\n");
}

main().catch((err) => {
	process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
	process.exit(1);
});
