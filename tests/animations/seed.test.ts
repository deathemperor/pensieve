import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("seed.json defines an animations collection with required fields", () => {
  const seed = JSON.parse(readFileSync("seed/seed.json", "utf8"));
  const anim = seed.collections.find(
    (c: { slug: string }) => c.slug === "animations",
  );
  assert.ok(anim, "animations collection exists");

  const fieldSlugs = anim.fields.map((f: { slug: string }) => f.slug);
  for (const required of ["title", "hero_component", "language"]) {
    assert.ok(fieldSlugs.includes(required), `field "${required}" present`);
  }
});

test("seed.json has a placeholder animation entry", () => {
  const seed = JSON.parse(readFileSync("seed/seed.json", "utf8"));
  const entry = seed.content?.animations?.find(
    (e: { slug: string }) => e.slug === "placeholder",
  );
  assert.ok(entry, "placeholder entry exists");
  assert.equal(entry.status, "published");
  assert.equal(
    entry.data.hero_component,
    "src/animations/placeholder/index.astro",
  );
});
