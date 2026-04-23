import { test } from "node:test";
import assert from "node:assert/strict";
import { extractGmapsCandidates, type TakeoutRecord } from "../../src/utils/takeoutGmaps";

function visit(
	placeId: string,
	lat: number,
	lng: number,
	startIso: string,
	endIso: string,
	semanticType: string = "Unknown",
	probability: string = "0.8",
): TakeoutRecord {
	return {
		startTime: startIso,
		endTime: endIso,
		visit: {
			topCandidate: {
				placeID: placeId,
				placeLocation: `geo:${lat},${lng}`,
				semanticType,
				probability,
			},
			probability: "0.8",
		},
	};
}

function activity(startIso: string, endIso: string): TakeoutRecord {
	return { startTime: startIso, endTime: endIso, activity: {} };
}

test("activity records are ignored", () => {
	const out = extractGmapsCandidates([
		activity("2020-01-01T08:00:00+07:00", "2020-01-01T09:00:00+07:00"),
	]);
	assert.deepEqual(out, []);
});

test("Home / Work visits are skipped by default", () => {
	const out = extractGmapsCandidates([
		visit("p1", 10.78, 106.70, "2020-01-01T08:00:00+07:00", "2020-01-01T18:00:00+07:00", "Home"),
		visit("p2", 10.81, 106.65, "2020-01-01T09:00:00+07:00", "2020-01-01T18:00:00+07:00", "Work"),
	]);
	assert.deepEqual(out, []);
});

test("short visits (<60min default) are dropped", () => {
	const out = extractGmapsCandidates([
		visit("p-short", 10.78, 106.70, "2020-01-01T12:00:00+07:00", "2020-01-01T12:30:00+07:00"),
	]);
	assert.deepEqual(out, []);
});

test("low-probability candidates are dropped", () => {
	const out = extractGmapsCandidates([
		visit("p-low", 10.78, 106.70, "2020-01-01T12:00:00+07:00", "2020-01-01T18:00:00+07:00", "Unknown", "0.1"),
	]);
	assert.deepEqual(out, []);
});

test("a qualifying visit produces a candidate with the local-date", () => {
	const out = extractGmapsCandidates([
		visit("p-a", 51.501, -0.142, "2018-04-02T10:00:00+01:00", "2018-04-02T15:00:00+01:00"),
	]);
	assert.equal(out.length, 1);
	assert.equal(out[0].source_id, "p-a");
	assert.equal(out[0].iso_date, "2018-04-02");
	assert.equal(out[0].precision, "day");
	assert.equal(out[0].suggested_category, "travel");
	assert.equal(out[0].place_lat, 51.5); // coarsened to 2 decimals
	assert.equal(out[0].place_lng, -0.14);
	assert.equal(out[0].visits_seen, 1);
});

test("dedupe by placeID — same place visited twice counts once, keeps earliest date", () => {
	const out = extractGmapsCandidates([
		visit("p-dup", 10.78, 106.70, "2020-06-10T10:00:00+07:00", "2020-06-10T13:00:00+07:00"),
		visit("p-dup", 10.78, 106.70, "2020-01-01T10:00:00+07:00", "2020-01-01T13:00:00+07:00"),
	]);
	assert.equal(out.length, 1);
	assert.equal(out[0].iso_date, "2020-01-01");
	assert.equal(out[0].visits_seen, 2);
});

test("regular haunts (visits_seen > maxVisitsBeforeDrop) are dropped", () => {
	const records: TakeoutRecord[] = [];
	for (let i = 0; i < 12; i++) {
		records.push(visit(
			"p-haunt",
			10.78, 106.70,
			`2020-${String(i + 1).padStart(2, "0")}-05T10:00:00+07:00`,
			`2020-${String(i + 1).padStart(2, "0")}-05T13:00:00+07:00`,
		));
	}
	const out = extractGmapsCandidates(records);
	assert.equal(out.length, 0);
});

test("output is sorted oldest-first", () => {
	const out = extractGmapsCandidates([
		visit("p-z", 10, 10, "2022-06-01T10:00:00+07:00", "2022-06-01T12:00:00+07:00"),
		visit("p-a", 11, 11, "2015-01-01T10:00:00+07:00", "2015-01-01T12:00:00+07:00"),
		visit("p-m", 12, 12, "2018-09-09T10:00:00+07:00", "2018-09-09T12:00:00+07:00"),
	]);
	assert.deepEqual(out.map((c) => c.iso_date), ["2015-01-01", "2018-09-09", "2022-06-01"]);
});

test("privacy: coordinates coarsened to 2 decimals (~1km)", () => {
	const out = extractGmapsCandidates([
		visit("p-priv", 10.771260, 106.694135, "2020-01-01T10:00:00+07:00", "2020-01-01T13:00:00+07:00"),
	]);
	assert.equal(out[0].place_lat, 10.77);
	assert.equal(out[0].place_lng, 106.69);
});

test("options: skipSemanticTypes can be overridden", () => {
	const out = extractGmapsCandidates(
		[
			visit("p-home", 10.78, 106.70, "2020-01-01T08:00:00+07:00", "2020-01-01T18:00:00+07:00", "Home"),
		],
		{ skipSemanticTypes: [] }, // allow Home this run
	);
	assert.equal(out.length, 1);
	assert.equal(out[0].semantic_type, "Home");
});
