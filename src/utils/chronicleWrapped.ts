/**
 * Build a per-year Wrapped recap from Chronicle entries.
 *
 * Pure function — no side effects, easy to test. Given a list of
 * parsed entries, returns one summary per populated year:
 *   {
 *     year, count, categories: {slug → count}, places, countries,
 *     span_days: number of days covered between first and last,
 *     emotional_tilt: net (family + milestone + love) - (loss)
 *   }
 */

export interface WrappedInput {
	event_date: string; // YYYY-MM-DD
	category: string;
	location: string | null | undefined; // stored JSON string OR null
}

export interface WrappedYear {
	year: number;
	count: number;
	categories: Record<string, number>;
	places: number;      // distinct place names or coords
	countries: number;   // distinct country codes/names
	firstDate: string;
	lastDate: string;
	spanDays: number;
	tilt: number;        // tilt = (family + milestone + love) - (loss); negative → heavy year
}

function parseLoc(raw: string | null | undefined): { name?: string; country?: string; lat?: number; lng?: number } | null {
	if (!raw) return null;
	try {
		const v = JSON.parse(raw);
		if (typeof v === "object" && v !== null) return v;
		return null;
	} catch {
		return null;
	}
}

export function buildWrapped(entries: WrappedInput[]): WrappedYear[] {
	const byYear = new Map<number, WrappedInput[]>();
	for (const e of entries) {
		const y = Number(e.event_date.slice(0, 4));
		if (!Number.isFinite(y)) continue;
		const list = byYear.get(y) ?? [];
		list.push(e);
		byYear.set(y, list);
	}

	const POSITIVE = new Set(["family", "milestone", "love", "travel"]);
	const NEGATIVE = new Set(["loss"]);

	const out: WrappedYear[] = [];
	for (const [year, list] of byYear) {
		const categories: Record<string, number> = {};
		const placeKeys = new Set<string>();
		const countryKeys = new Set<string>();
		let first = list[0].event_date;
		let last = list[0].event_date;
		let tilt = 0;
		for (const e of list) {
			categories[e.category] = (categories[e.category] ?? 0) + 1;
			if (e.event_date < first) first = e.event_date;
			if (e.event_date > last) last = e.event_date;
			if (POSITIVE.has(e.category)) tilt += 1;
			else if (NEGATIVE.has(e.category)) tilt -= 1;
			const loc = parseLoc(e.location);
			if (loc) {
				if (loc.name) placeKeys.add(loc.name);
				else if (typeof loc.lat === "number" && typeof loc.lng === "number") {
					placeKeys.add(`${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}`);
				}
				if (loc.country) countryKeys.add(loc.country);
			}
		}
		const firstMs = Date.parse(`${first}T00:00:00Z`);
		const lastMs = Date.parse(`${last}T00:00:00Z`);
		const spanDays = Math.max(0, Math.round((lastMs - firstMs) / 86_400_000));
		out.push({
			year,
			count: list.length,
			categories,
			places: placeKeys.size,
			countries: countryKeys.size,
			firstDate: first,
			lastDate: last,
			spanDays,
			tilt,
		});
	}
	out.sort((a, b) => b.year - a.year);
	return out;
}
