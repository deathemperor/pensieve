#!/usr/bin/env -S node --import tsx
/**
 * ingest-gmaps: read a Google Maps Timeline JSON (on-device export from
 * Google Maps iOS/Android) and emit draft Chronicle candidates as NDJSON.
 *
 * Phone-export (2024+) produces a top-level array of records. This script
 * drops `activity` records (motion), drops Home/Work visits, drops short
 * visits, dedupes by Google place_id keeping the earliest date, and drops
 * regular haunts (visits_seen > 8 by default).
 *
 * Usage:
 *   npx tsx scripts/chronicle/ingest-gmaps.ts ~/Downloads/location-history.json
 *
 * Pipe through jq to inspect:
 *   npx tsx scripts/chronicle/ingest-gmaps.ts ~/Downloads/location-history.json \
 *     | jq -s 'sort_by(.iso_date) | .[] | select(.visits_seen == 1)'
 *
 * Output is review-only — no rows are written. Copy meaningful lines into
 * seed/seed.json (fill in a title + name, promote from draft to published).
 */

import { readFileSync } from "node:fs";
import { extractGmapsCandidates } from "../../src/utils/takeoutGmaps.js";

function parseArgs(argv: string[]): { path: string; minDuration?: number; maxSeen?: number } {
	const out: { path: string; minDuration?: number; maxSeen?: number } = { path: "" };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--min-duration" && argv[i + 1]) { out.minDuration = Number(argv[++i]); continue; }
		if (a === "--max-seen" && argv[i + 1]) { out.maxSeen = Number(argv[++i]); continue; }
		if (!out.path && !a.startsWith("--")) { out.path = a; continue; }
	}
	return out;
}

function main(argv: string[]): void {
	const { path, minDuration, maxSeen } = parseArgs(argv);
	if (!path) {
		console.error("usage: ingest-gmaps <location-history.json> [--min-duration 60] [--max-seen 8]");
		process.exit(1);
	}

	const raw = readFileSync(path, "utf8");
	let records: unknown;
	try {
		records = JSON.parse(raw);
	} catch (err) {
		console.error(`failed to parse ${path}: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	}
	if (!Array.isArray(records)) {
		console.error(`expected top-level array in ${path}, got ${typeof records}`);
		process.exit(1);
	}

	const candidates = extractGmapsCandidates(records, {
		minDurationMinutes: minDuration,
		maxVisitsBeforeDrop: maxSeen,
	});

	for (const c of candidates) {
		process.stdout.write(JSON.stringify(c) + "\n");
	}

	process.stderr.write(
		`\n▸ ${records.length} records → ${candidates.length} candidates\n`,
	);
}

main(process.argv.slice(2));
