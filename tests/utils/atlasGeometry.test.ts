import { test } from "node:test";
import assert from "node:assert/strict";
import {
	projectLatLng,
	DEFAULT_ATLAS_BOUNDS,
	graticuleLngs,
	graticuleLats,
} from "../../src/utils/atlasGeometry";

test("projectLatLng: equator + prime meridian maps near mid-x (wide world bounds)", () => {
	const p = projectLatLng({ lat: 0, lng: 0 }, DEFAULT_ATLAS_BOUNDS, { widthPx: 1000, heightPx: 500 });
	// lng 0 in [-130, 150] → 130/280 ≈ 0.464 of viewport width
	assert.ok(p.x > 420 && p.x < 500, `unexpected x for lng=0: ${p.x}`);
	// lat 0 in [-10, 65] → 1 - (10/75) ≈ 0.867 of viewport height
	assert.ok(p.y > 430 && p.y < 440, `unexpected y for lat=0: ${p.y}`);
});

test("projectLatLng: Old Trafford (Manchester, UK) lands left of center, upper half", () => {
	const p = projectLatLng({ lat: 53.46, lng: -2.29 }, DEFAULT_ATLAS_BOUNDS, { widthPx: 1000, heightPx: 500 });
	// UK at lng -2.29 in [-130, 150]: (127.71 / 280) ≈ 0.456 — just left of center
	assert.ok(p.x > 400 && p.x < 500, `Manchester x: ${p.x}`);
	assert.ok(p.y < 150, `Manchester latitude should be upper: ${p.y}`);
});

test("projectLatLng: Ho Chi Minh City lands right of center, lower half", () => {
	const p = projectLatLng({ lat: 10.78, lng: 106.70 }, DEFAULT_ATLAS_BOUNDS, { widthPx: 1000, heightPx: 500 });
	// HCMC at lng 106.70 in [-130, 150]: (236.70 / 280) ≈ 0.845
	assert.ok(p.x > 800, `HCMC should be far-right of center: ${p.x}`);
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
	// -130..150 at step 30: start = ceil(-130/30)*30 = -4*30 = -120, end 150
	assert.deepEqual(lngs, [-120, -90, -60, -30, 0, 30, 60, 90, 120, 150]);
});

test("graticuleLats: produces 30° steps within default bounds", () => {
	const lats = graticuleLats(DEFAULT_ATLAS_BOUNDS, 30);
	// -10..65 at step 30: 0, 30, 60 (start at ceil(-10/30)*30 = 0)
	assert.deepEqual(lats, [0, 30, 60]);
});
