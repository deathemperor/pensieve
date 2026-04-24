import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOcrResponse } from "../../src/lib/portraits/ocr";

test("parseOcrResponse: returns structured object on valid JSON", () => {
  const raw = `{"name":"Jensen Huang","title":"CEO","company":"NVIDIA","emails":["j@n.com"],"phones":["+1 408 000 0000"],"websites":["nvidia.com"],"socials":{}}`;
  const r = parseOcrResponse(raw);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.name, "Jensen Huang");
    assert.deepEqual(r.value.emails, ["j@n.com"]);
  }
});

test("parseOcrResponse: tolerates markdown code fences", () => {
  const raw = '```json\n{"name":"A","title":null,"company":null,"emails":[],"phones":[],"websites":[],"socials":{}}\n```';
  const r = parseOcrResponse(raw);
  assert.equal(r.ok, true);
});

test("parseOcrResponse: rejects non-JSON", () => {
  const r = parseOcrResponse("I couldn't read the card.");
  assert.equal(r.ok, false);
});

test("parseOcrResponse: rejects missing required shape", () => {
  const r = parseOcrResponse(`{"unexpected":true}`);
  assert.equal(r.ok, false);
});
