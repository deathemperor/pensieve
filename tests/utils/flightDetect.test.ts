import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFlight } from "../../src/utils/flightDetect";

test("detectFlight: positive cases (IATA flight codes)", () => {
	assert.ok(detectFlight("SQ186 SGN → HAN"));
	assert.ok(detectFlight("VN255 Hanoi to Saigon"));
	assert.ok(detectFlight("BL6020"));
	assert.ok(detectFlight("BA 42"));
	assert.ok(detectFlight("QF9 London"));
});

test("detectFlight: negative cases", () => {
	assert.ok(!detectFlight("Sprint review with PM team"));
	assert.ok(!detectFlight("1:1 Linh"));
	assert.ok(!detectFlight(""));
	assert.ok(!detectFlight("123 ABC"));
	assert.ok(!detectFlight("Meeting at ABC123 tower"));
});

test("detectFlight: returns object with code and trimmed title", () => {
	const hit = detectFlight("SQ186 HAN → SGN");
	assert.deepEqual(hit, { code: "SQ186", rest: "HAN → SGN" });
});
