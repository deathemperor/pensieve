import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR_INFO, TABLE_START_YEAR, TABLE_END_YEAR } from "../../src/utils/lunar-table";

test("YEAR_INFO covers 1900-2100 inclusive", () => {
	assert.equal(YEAR_INFO.length, TABLE_END_YEAR - TABLE_START_YEAR + 1);
	assert.equal(TABLE_START_YEAR, 1900);
	assert.equal(TABLE_END_YEAR, 2100);
});

test("YEAR_INFO entries are all non-zero integers", () => {
	for (let i = 0; i < YEAR_INFO.length; i++) {
		assert.ok(Number.isInteger(YEAR_INFO[i]), `YEAR_INFO[${i}] (year ${1900 + i}) must be an integer`);
		assert.ok(YEAR_INFO[i] > 0, `YEAR_INFO[${i}] (year ${1900 + i}) must be > 0`);
	}
});
