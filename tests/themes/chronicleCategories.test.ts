import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chronicleCategories,
  getChronicleCategory,
  CHRONICLE_CATEGORY_SLUGS,
} from "../../src/themes/chronicleCategories";

test("exposes exactly 7 categories", () => {
  assert.equal(chronicleCategories.length, 7);
});

test("each category has the full shape", () => {
  for (const c of chronicleCategories) {
    assert.ok(c.slug.length > 0, `missing slug`);
    assert.match(c.hex, /^#[0-9a-f]{6}$/i, `bad hex: ${c.hex}`);
    assert.ok(c.label_en, `missing label_en for ${c.slug}`);
    assert.ok(c.label_vi, `missing label_vi for ${c.slug}`);
    assert.ok(c.symbol, `missing symbol for ${c.slug}`);
  }
});

test("slugs list matches the categories array", () => {
  assert.deepEqual(
    [...CHRONICLE_CATEGORY_SLUGS].sort(),
    chronicleCategories.map((c) => c.slug).sort(),
  );
});

test("getChronicleCategory returns the category by slug", () => {
  assert.equal(getChronicleCategory("loss")?.hex, "#b54b3c");
  assert.equal(getChronicleCategory("family")?.hex, "#5e6ad2");
});

test("getChronicleCategory falls back to milestone for unknown slug", () => {
  assert.equal(getChronicleCategory("unknown")?.slug, "milestone");
});

test("getChronicleCategory handles null and undefined", () => {
  assert.equal(getChronicleCategory(null)?.slug, "milestone");
  assert.equal(getChronicleCategory(undefined)?.slug, "milestone");
});
