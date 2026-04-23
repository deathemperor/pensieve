/**
 * Google Maps Timeline (2024+ on-device export) parser.
 *
 * The phone-exported `location-history.json` is a flat JSON array of
 * records. Each record is either:
 *   - a `visit`   — the phone decided the user stopped at a place
 *   - an `activity` — motion between two places (walk, drive, etc.)
 *
 * Only `visit` records are interesting for the Chronicle. We filter
 * aggressively to cut the ~50k-record typical export down to a few
 * hundred candidate "first notable visits" that an admin can review.
 *
 * Pure functions only — the CLI wrapper handles file I/O.
 */

export type SemanticType =
	| "Home"
	| "Work"
	| "Shopping"
	| "Unknown"
	| string;

export interface TakeoutRecord {
	startTime: string;
	endTime: string;
	visit?: {
		hierarchyLevel?: string;
		probability?: string;
		topCandidate?: {
			probability?: string;
			semanticType?: SemanticType;
			placeID?: string;
			placeLocation?: string; // "geo:lat,lng"
		};
	};
	activity?: unknown;
}

export interface GmapsVisitCandidate {
	source: "google-maps";
	source_id: string;       // Google place_id
	iso_date: string;        // YYYY-MM-DD (local date of the visit)
	precision: "day";
	suggested_category: "travel";
	place_lat: number;
	place_lng: number;
	semantic_type: string;
	visit_duration_minutes: number;
	first_visit_year: number;
	visits_seen: number;
}

export interface ExtractOptions {
	/** Drop visits shorter than this many minutes. Default 60. */
	minDurationMinutes?: number;
	/** Drop visits with semanticType in this set. Default [Home, Work]. */
	skipSemanticTypes?: string[];
	/** If a place is visited more than this times across the whole export, it's a regular haunt — drop it. Default 8. */
	maxVisitsBeforeDrop?: number;
	/** Drop visits where topCandidate.probability is below this. Default 0.35. */
	minCandidateProbability?: number;
}

const GEO_RE = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

function parseGeo(s: string | undefined): { lat: number; lng: number } | null {
	if (!s) return null;
	const m = s.match(GEO_RE);
	if (!m) return null;
	const lat = Number(m[1]);
	const lng = Number(m[2]);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	return { lat, lng };
}

function minutesBetween(startIso: string, endIso: string): number {
	const s = Date.parse(startIso);
	const e = Date.parse(endIso);
	if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
	return Math.max(0, (e - s) / 60000);
}

/** Extract the local-date YYYY-MM-DD from Google's timezone-aware timestamp. */
function localDate(iso: string): string {
	// "2013-05-05T15:38:35.301+07:00" — the date part up to T is already in the
	// event's local timezone per Google's export. Take the first 10 chars.
	return iso.slice(0, 10);
}

export function extractGmapsCandidates(
	records: unknown[],
	opts: ExtractOptions = {},
): GmapsVisitCandidate[] {
	const minDur = opts.minDurationMinutes ?? 60;
	const skipTypes = new Set(opts.skipSemanticTypes ?? ["Home", "Work"]);
	const maxSeen = opts.maxVisitsBeforeDrop ?? 8;
	const minProb = opts.minCandidateProbability ?? 0.35;

	interface Bucket {
		placeId: string;
		firstDate: string;
		firstYear: number;
		coord: { lat: number; lng: number };
		semanticType: string;
		totalMinutes: number;
		visitsSeen: number;
	}

	const buckets = new Map<string, Bucket>();

	for (const raw of records) {
		if (!raw || typeof raw !== "object") continue;
		const rec = raw as TakeoutRecord;
		if (!rec.visit) continue;
		const top = rec.visit.topCandidate;
		if (!top) continue;
		const placeId = top.placeID;
		if (!placeId) continue;
		const semanticType = top.semanticType ?? "Unknown";
		if (skipTypes.has(semanticType)) continue;
		const coord = parseGeo(top.placeLocation);
		if (!coord) continue;
		const probability = Number(top.probability ?? "0");
		if (probability < minProb) continue;
		const duration = minutesBetween(rec.startTime, rec.endTime);
		if (duration < minDur) continue;

		const date = localDate(rec.startTime);
		const year = Number(date.slice(0, 4));
		if (!Number.isFinite(year)) continue;

		const existing = buckets.get(placeId);
		if (!existing) {
			buckets.set(placeId, {
				placeId,
				firstDate: date,
				firstYear: year,
				coord,
				semanticType,
				totalMinutes: duration,
				visitsSeen: 1,
			});
		} else {
			if (date < existing.firstDate) {
				existing.firstDate = date;
				existing.firstYear = year;
			}
			existing.totalMinutes += duration;
			existing.visitsSeen += 1;
		}
	}

	const candidates: GmapsVisitCandidate[] = [];
	for (const b of buckets.values()) {
		if (b.visitsSeen > maxSeen) continue;
		candidates.push({
			source: "google-maps",
			source_id: b.placeId,
			iso_date: b.firstDate,
			precision: "day",
			suggested_category: "travel",
			place_lat: Math.round(b.coord.lat * 100) / 100, // ~1km privacy coarsening
			place_lng: Math.round(b.coord.lng * 100) / 100,
			semantic_type: b.semanticType,
			visit_duration_minutes: Math.round(b.totalMinutes),
			first_visit_year: b.firstYear,
			visits_seen: b.visitsSeen,
		});
	}

	// Sort oldest first so reviewers see the timeline naturally.
	candidates.sort((a, b) => a.iso_date.localeCompare(b.iso_date));
	return candidates;
}
