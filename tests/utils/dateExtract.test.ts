import { test } from "node:test";
import assert from "node:assert/strict";
import {
	extractDatesFromText,
	extractDatesFromPortableText,
	type ExtractedDate,
} from "../../src/utils/dateExtract";

function isos(results: ExtractedDate[]): string[] {
	return results.map((r) => `${r.isoDate}:${r.precision}`);
}

test("DD/MM/YYYY extracted with day precision", () => {
	const out = extractDatesFromText("We met on 14/12/2021 at the cafe.");
	assert.deepEqual(isos(out), ["2021-12-14:day"]);
});

test("D-M-YYYY with dashes extracted with day precision", () => {
	const out = extractDatesFromText("Event on 2-4-2018.");
	assert.deepEqual(isos(out), ["2018-04-02:day"]);
});

test("ISO YYYY-MM-DD extracted with day precision", () => {
	const out = extractDatesFromText("Timestamp: 2021-05-21 was quiet.");
	assert.deepEqual(isos(out), ["2021-05-21:day"]);
});

test("Vietnamese 'tháng M năm YYYY' extracted with month precision", () => {
	const out = extractDatesFromText("Founded in tháng 5 năm 2015.");
	assert.deepEqual(isos(out), ["2015-05-01:month"]);
});

test("Vietnamese 'tháng M/YYYY' extracted with month precision", () => {
	const out = extractDatesFromText("Founded in tháng 5/2015.");
	assert.deepEqual(isos(out), ["2015-05-01:month"]);
});

test("English 'Month YYYY' extracted with month precision", () => {
	const out = extractDatesFromText("Founded in May 2015.");
	assert.deepEqual(isos(out), ["2015-05-01:month"]);
});

test("future dates are dropped", () => {
	const year = new Date().getUTCFullYear();
	const out = extractDatesFromText(`On 01/01/${year + 10} we celebrate.`);
	assert.deepEqual(out, []);
});

test("calendar-invalid dates are dropped", () => {
	const out = extractDatesFromText("Weird date 30/02/2021 nope.");
	assert.deepEqual(out, []);
});

test("year-only mentions are NOT extracted", () => {
	const out = extractDatesFromText("In 2018 I traveled to London.");
	assert.deepEqual(out, []);
});

test("context snippet centers on the match, 60 chars", () => {
	const long = "a".repeat(100) + " 14/12/2021 " + "b".repeat(100);
	const out = extractDatesFromText(long);
	assert.equal(out.length, 1);
	assert.ok(out[0].context.includes("14/12/2021"));
	assert.ok(out[0].context.length <= 65); // snippet ~60 with word boundaries
});

test("dedupe: same iso+precision in one text returns one result", () => {
	const out = extractDatesFromText("Met 14/12/2021 and again on 14/12/2021.");
	assert.equal(out.length, 1);
});

test("multiple distinct dates come out in text order", () => {
	const out = extractDatesFromText("First 15/03/2004 then 14/12/2021.");
	assert.deepEqual(isos(out), ["2004-03-15:day", "2021-12-14:day"]);
});

test("extractDatesFromPortableText skips blockquote style", () => {
	const blocks = [
		{ _type: "block", style: "normal", children: [{ _type: "span", text: "Real date 14/12/2021." }] },
		{ _type: "block", style: "blockquote", children: [{ _type: "span", text: "Quote: 02/04/2018 is mentioned." }] },
	];
	const out = extractDatesFromPortableText(blocks);
	assert.deepEqual(isos(out), ["2021-12-14:day"]);
});

test("extractDatesFromPortableText flattens children spans in order", () => {
	const blocks = [
		{
			_type: "block",
			style: "normal",
			children: [
				{ _type: "span", text: "Started on " },
				{ _type: "span", text: "15/03/2004", marks: ["strong"] },
				{ _type: "span", text: " and ended later." },
			],
		},
	];
	const out = extractDatesFromPortableText(blocks);
	assert.deepEqual(isos(out), ["2004-03-15:day"]);
});

test("extractDatesFromPortableText ignores non-block _type items", () => {
	const blocks = [
		{ _type: "image", url: "abc" },
		{ _type: "block", style: "normal", children: [{ _type: "span", text: "Date 21/05/2021 here." }] },
	];
	const out = extractDatesFromPortableText(blocks);
	assert.deepEqual(isos(out), ["2021-05-21:day"]);
});
