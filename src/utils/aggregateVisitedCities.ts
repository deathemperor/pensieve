/**
 * Grid-aggregate Google Timeline candidates into "city cells" for the
 * Atlas. Each cell is a ~25km square (0.25° at the equator). Cells
 * become circles on the Atlas background, sized by visit count.
 *
 * This is a PRESENTATION aggregation — the underlying Chronicle event
 * entries are separate (rendered as sharp pins on top). A cell might
 * contain zero or many event pins; the count reflects how often Google
 * logged the user in that rough geographic area, regardless of events.
 */

import type { GmapsVisitCandidate } from "./takeoutGmaps";

export interface VisitedCellRaw {
	/** Stable ID: rounded (lat,lng) tuple joined with underscore. */
	id: string;
	/** Cell-center latitude. */
	lat: number;
	/** Cell-center longitude. */
	lng: number;
	/** Number of distinct places Google logged in this cell. */
	places: number;
	/** Sum of visits_seen across all places in the cell. */
	visits: number;
	/** Earliest ISO date the user was seen in this cell. */
	firstDate: string;
	/** Latest ISO date the user was seen in this cell. */
	lastDate: string;
}

export interface AggregateOptions {
	/** Degrees per grid cell side. Default 0.25 (~25 km at equator). */
	cellDeg?: number;
}

export function aggregateVisitedCities(
	candidates: GmapsVisitCandidate[],
	opts: AggregateOptions = {},
): VisitedCellRaw[] {
	const cellDeg = opts.cellDeg ?? 0.25;
	const buckets = new Map<string, VisitedCellRaw>();
	for (const c of candidates) {
		const cellLat = Math.floor(c.place_lat / cellDeg) * cellDeg;
		const cellLng = Math.floor(c.place_lng / cellDeg) * cellDeg;
		const id = `${cellLat.toFixed(2)}_${cellLng.toFixed(2)}`;
		const existing = buckets.get(id);
		const centerLat = +(cellLat + cellDeg / 2).toFixed(2);
		const centerLng = +(cellLng + cellDeg / 2).toFixed(2);
		if (!existing) {
			buckets.set(id, {
				id,
				lat: centerLat,
				lng: centerLng,
				places: 1,
				visits: c.visits_seen,
				firstDate: c.iso_date,
				lastDate: c.iso_date,
			});
		} else {
			existing.places += 1;
			existing.visits += c.visits_seen;
			if (c.iso_date < existing.firstDate) existing.firstDate = c.iso_date;
			if (c.iso_date > existing.lastDate) existing.lastDate = c.iso_date;
		}
	}
	// Sort by visits descending so the biggest cities render first / bottom.
	return [...buckets.values()].sort((a, b) => b.visits - a.visits);
}
