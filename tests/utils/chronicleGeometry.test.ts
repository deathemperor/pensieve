import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthToAngleDeg,
  ringRadiusForYear,
  fanCluster,
} from "../../src/utils/chronicleGeometry";

test("monthToAngleDeg: Jan=0, Apr=90, Jul=180, Oct=270", () => {
  assert.equal(monthToAngleDeg(1), 0);
  assert.equal(monthToAngleDeg(4), 90);
  assert.equal(monthToAngleDeg(7), 180);
  assert.equal(monthToAngleDeg(10), 270);
});

test("monthToAngleDeg: null month returns null (for year-precision)", () => {
  assert.equal(monthToAngleDeg(null), null);
});

test("ringRadiusForYear: newer years go inward", () => {
  const years = [2004, 2015, 2018, 2021];
  const radii = years.map((y) => ringRadiusForYear(y, years, { innerPx: 70, outerPx: 210 }));
  assert.equal(radii[0], 210);  // 2004 = outermost
  assert.equal(radii[3], 70);   // 2021 = innermost
  assert.ok(radii[1] > radii[2]);
});

test("ringRadiusForYear: single year returns innermost", () => {
  assert.equal(ringRadiusForYear(2021, [2021], { innerPx: 70, outerPx: 210 }), 70);
});

test("fanCluster: stars within 4 deg get symmetric offsets", () => {
  const stars = [
    { id: "a", angle: 120 },
    { id: "b", angle: 122 }, // within 4 deg of a
    { id: "c", angle: 200 }, // alone
  ];
  const out = fanCluster(stars, { thresholdDeg: 4, fanDeg: 3 });
  // mid of 120 and 122 is 121; so a -> 118, b -> 124.
  assert.equal(out.find((s) => s.id === "a")!.angle, 118);
  assert.equal(out.find((s) => s.id === "b")!.angle, 124);
  assert.equal(out.find((s) => s.id === "c")!.angle, 200);
});
