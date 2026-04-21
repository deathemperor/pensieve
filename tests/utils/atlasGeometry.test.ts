import { test } from "node:test";
import assert from "node:assert/strict";
import {
	projectLatLng,
	DEFAULT_ATLAS_BOUNDS,
	graticuleLngs,
	graticuleLats,
} from "../../src/utils/atlasGeometry";

test("projectLatLng: equator + prime meridian within bounds maps mid-ish", () => {
	const p = projectLatLng({ lat: 0, lng: 0 }, DEFAULT_ATLAS_BOUNDS, { widthPx: 1000, heightPx: 500 });
	// lng 0 in [-15, 130] → 15/145 ≈ 0.103 of viewport width
	assert.ok(p.x > 90 && p.x < 120, `unexpected x for lng=0: ${p.x}`);
	// lat 0 in [-10, 65] → 1 - (10/75) ≈ 0.867 of viewport height
	assert.ok(p.y > 430 && p.y < 440, `unexpected y for lat=0: ${p.y}`);
});

test("projectLatLng: Old Trafford (Manchester, UK) lands in upper-left quadrant", () => {
	const p = projectLatLng({ lat: 53.46, lng: -2.29 }, DEFAULT_ATLAS_BOUNDS, { widthPx: 1000, heightPx: 500 });
	assert.ok(p.x < 300, `Manchester should be left of center: ${p.x}`);
	assert.ok(p.y < 150, `Manchester latitude should be upper: ${p.y}`);
});

test("projectLatLng: Ho Chi Minh City lands in lower-right quadrant", () => {
	const p = projectLatLng({ lat: 10.78, lng: 106.70 }, DEFAULT_ATLAS_BOUNDS, { widthPx: 1000, heightPx: 500 });
	assert.ok(p.x > 700, `HCMC should be right of center: ${p.x}`);
	assert.ok(p.y > 300 && p.y < 400, `HCMC latitude should be lower-middle: ${p.y}`);
});

test("projectLatLng: clamps to viewport for out-of-bounds input", () => {
	const p = projectLatLng({ lat: 80, lng: 170 }, DEFAULT_ATLAS_BOUNDS, { widthPx: 1000, heightPx: 500 });
	assert.equal(p.x, 1000, `should clamp to right edge`);
	assert.equal(p.y, 0, `should clamp to top edge`);
});

test("projectLatLng: throws on invalid bounds", () => {
	assert.throws(() => projectLatLng(
		{ lat: 0, lng: 0 },
		{ latMin: 10, latMax: 5, lngMin: 0, lngMax: 10 },
		{ widthPx: 100, heightPx: 100 },
	));
});

test("graticuleLngs: produces 30° steps within default bounds", () => {
	const lngs = graticuleLngs(DEFAULT_ATLAS_BOUNDS, 30);
	// -15..130 at step 30: 0, 30, 60, 90, 120 (start at ceil(-15/30)*30 = 0)
	assert.deepEqual(lngs, [0, 30, 60, 90, 120]);
});

test("graticuleLats: produces 30° steps within default bounds", () => {
	const lats = graticuleLats(DEFAULT_ATLAS_BOUNDS, 30);
	// -10..65 at step 30: 0, 30, 60 (start at ceil(-10/30)*30 = 0)
	assert.deepEqual(lats, [0, 30, 60]);
});
