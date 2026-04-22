import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVCard } from "../../src/lib/portraits/vcard";

test("parseVCard: single contact", () => {
  const vcf = `BEGIN:VCARD
VERSION:3.0
FN:Jensen Huang
TITLE:CEO
ORG:NVIDIA
EMAIL:jensen@example.com
TEL:+1 408 555 1212
END:VCARD`;
  const out = parseVCard(vcf);
  assert.equal(out.length, 1);
  assert.equal(out[0].full_name, "Jensen Huang");
  assert.equal(out[0].title, "CEO");
  assert.equal(out[0].company, "NVIDIA");
  assert.deepEqual(out[0].emails, ["jensen@example.com"]);
  assert.deepEqual(out[0].phones, ["+1 408 555 1212"]);
});

test("parseVCard: multiple contacts", () => {
  const vcf = `BEGIN:VCARD
VERSION:3.0
FN:A
EMAIL:a@x.com
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:B
EMAIL:b@x.com
END:VCARD`;
  const out = parseVCard(vcf);
  assert.equal(out.length, 2);
  assert.equal(out[0].full_name, "A");
  assert.equal(out[1].full_name, "B");
});

test("parseVCard: handles multiple emails/phones per contact", () => {
  const vcf = `BEGIN:VCARD
VERSION:3.0
FN:Multi
EMAIL;TYPE=WORK:w@x.com
EMAIL;TYPE=HOME:h@x.com
TEL:+1 111
TEL:+2 222
END:VCARD`;
  const out = parseVCard(vcf);
  assert.deepEqual(out[0].emails, ["w@x.com", "h@x.com"]);
  assert.deepEqual(out[0].phones, ["+1 111", "+2 222"]);
});

test("parseVCard: skips empty / malformed cards", () => {
  const vcf = `random garbage
BEGIN:VCARD
FN:Valid
END:VCARD`;
  const out = parseVCard(vcf);
  assert.equal(out.length, 1);
  assert.equal(out[0].full_name, "Valid");
});
