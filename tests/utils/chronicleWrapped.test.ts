import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWrapped, type WrappedInput } from "../../src/utils/chronicleWrapped";

function e(date: string, cat: string, loc: string | null = null): WrappedInput {
	return { event_date: date, category: cat, location: loc };
}

test("groups by year newest-first", () => {
	const out = buildWrapped([
		e("2015-03-13", "threshold"),
		e("2021-12-14", "family"),
		e("2018-04-02", "love"),
	]);
	assert.deepEqual(out.map((y) => y.year), [2021, 2018, 2015]);
});

test("category counts + entry count", () => {
	const out = buildWrapped([
		e("2021-05-21", "loss"),
		e("2021-12-14", "family"),
		e("2021-05-04", "threshold"),
	]);
	assert.equal(out.length, 1);
	assert.equal(out[0].count, 3);
	assert.deepEqual(out[0].categories, { loss: 1, family: 1, threshold: 1 });
});

test("tilt: loss subtracts, family/milestone/love/travel add", () => {
	const out = buildWrapped([
		e("2021-05-21", "loss"),
		e("2021-12-14", "family"),
		e("2021-05-04", "threshold"),
	]);
	// family +1, threshold 0 (not in either set), loss -1 → tilt 0
	assert.equal(out[0].tilt, 0);
});

test("span days = last - first within a year", () => {
	const out = buildWrapped([
		e("2021-05-04", "threshold"),
		e("2021-12-14", "family"),
	]);
	const expected = Math.round(
		(Date.parse("2021-12-14T00:00:00Z") - Date.parse("2021-05-04T00:00:00Z")) / 86_400_000,
	);
	assert.equal(out[0].spanDays, expected);
});

test("places and countries parse from location JSON", () => {
	const out = buildWrapped([
		e("2018-03-31", "milestone", '{"name":"Old Trafford","country":"GB","lat":53.46,"lng":-2.29}'),
		e("2018-04-02", "love", '{"name":"Buckingham Palace","country":"GB","lat":51.5,"lng":-0.14}'),
		e("2018-06-01", "travel", '{"country":"FR"}'),
	]);
	assert.equal(out[0].places, 2); // Old Trafford, Buckingham; third has no name
	assert.equal(out[0].countries, 2); // GB, FR
});

test("invalid location JSON is ignored gracefully", () => {
	const out = buildWrapped([
		e("2020-01-01", "threshold", "not json"),
	]);
	assert.equal(out[0].places, 0);
	assert.equal(out[0].countries, 0);
});
