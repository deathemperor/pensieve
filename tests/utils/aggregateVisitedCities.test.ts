import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateVisitedCities } from "../../src/utils/aggregateVisitedCities";
import type { GmapsVisitCandidate } from "../../src/utils/takeoutGmaps";

function cand(id: string, lat: number, lng: number, date: string, visits = 1): GmapsVisitCandidate {
	return {
		source: "google-maps",
		source_id: id,
		iso_date: date,
		precision: "day",
		suggested_category: "travel",
		place_lat: lat,
		place_lng: lng,
		semantic_type: "Unknown",
		visit_duration_minutes: 90,
		first_visit_year: Number(date.slice(0, 4)),
		visits_seen: visits,
	};
}

test("two close points in the same 0.25° cell aggregate to one city", () => {
	const out = aggregateVisitedCities([
		cand("a", 10.77, 106.69, "2020-01-01", 2),
		cand("b", 10.78, 106.70, "2020-01-15", 3),
	]);
	assert.equal(out.length, 1);
	assert.equal(out[0].places, 2);
	assert.equal(out[0].visits, 5);
	assert.equal(out[0].firstDate, "2020-01-01");
	assert.equal(out[0].lastDate, "2020-01-15");
});

test("distant points produce separate cities", () => {
	const out = aggregateVisitedCities([
		cand("a", 10.78, 106.70, "2020-01-01"),
		cand("b", 51.5, -0.14, "2020-05-01"),
	]);
	assert.equal(out.length, 2);
});

test("output is sorted by visits descending", () => {
	const out = aggregateVisitedCities([
		cand("a", 10.78, 106.70, "2020-01-01", 1),
		cand("b", 51.5, -0.14, "2020-02-01", 10),
		cand("c", 35.68, 139.69, "2020-03-01", 5),
	]);
	assert.deepEqual(out.map((c) => c.visits), [10, 5, 1]);
});

test("cell center is the midpoint of the cell", () => {
	// lat 10.77 with cellDeg 0.25 falls in the [10.75, 11.00) cell → center 10.875
	// lng 106.69 with cellDeg 0.25 falls in the [106.50, 106.75) cell → center 106.625
	const out = aggregateVisitedCities([
		cand("a", 10.77, 106.69, "2020-01-01"),
	], { cellDeg: 0.25 });
	assert.equal(out[0].lat, 10.88);
	assert.equal(out[0].lng, 106.63);
});

test("custom cellDeg collapses finer grouping", () => {
	// With cellDeg 5, HCMC (10.78) and Hanoi (21.02) both fall in different cells
	// — HCMC lat 10 → cell [10, 15) → center 12.5
	// — Hanoi lat 21 → cell [20, 25) → center 22.5
	const out = aggregateVisitedCities([
		cand("a", 10.78, 106.70, "2020-01-01"),
		cand("b", 21.02, 105.85, "2020-02-01"),
	], { cellDeg: 5 });
	assert.equal(out.length, 2);
});
