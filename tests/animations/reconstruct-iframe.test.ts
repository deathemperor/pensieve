import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reconstructIframeSrcdoc,
  pickHeroSource,
} from "../../src/lib/animations/reconstruct-iframe.ts";

test("reconstructIframeSrcdoc strips frontmatter fence and wraps body", () => {
  const src = `---
export const prerender = false;
const x = 42;
---

<div class="stage">hi</div>

<style>.stage{color:red}</style>`;
  const out = reconstructIframeSrcdoc(src, 7);
  assert.match(out, /<!doctype html>/i);
  assert.doesNotMatch(out, /prerender/);
  assert.match(out, /class="stage"/);
  assert.match(out, /\.stage\{color:red\}/);
  assert.match(out, /animation-cursor: 7/);
});

test("reconstructIframeSrcdoc handles source with no frontmatter", () => {
  const src = `<div>plain</div>`;
  const out = reconstructIframeSrcdoc(src, 0);
  assert.match(out, /<div>plain<\/div>/);
});

test("pickHeroSource prefers index.astro under the slug prefix", () => {
  const files = {
    "src/animations/demo/helper.astro": "helper",
    "src/animations/demo/index.astro": "index",
    "src/other/thing.astro": "other",
  };
  const r = pickHeroSource(files, "demo");
  assert.ok(r);
  assert.equal(r!.path, "src/animations/demo/index.astro");
  assert.equal(r!.source, "index");
});

test("pickHeroSource returns null when no matching file exists", () => {
  const r = pickHeroSource({}, "demo");
  assert.equal(r, null);
});
