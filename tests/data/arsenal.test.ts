import { test } from "node:test";
import assert from "node:assert/strict";
import {
	arsenal,
	ARSENAL_CATEGORIES,
	ARSENAL_FREQUENCIES,
	ARSENAL_PLATFORMS,
	type ArsenalItem,
} from "../../src/data/arsenal";

const expectedIconExt: Record<string, string> = {
	macos: "png",
	iphone: "png",
	cli: "svg",
};

test("every arsenal entry has required fields and valid enums", () => {
	for (const item of arsenal) {
		const ctx = `slug=${item.slug ?? "<missing>"}`;
		assert.ok(item.slug, `${ctx}: missing slug`);
		assert.match(item.slug, /^[a-z0-9][a-z0-9-]*$/, `${ctx}: slug must be url-safe`);
		assert.ok(item.title, `${ctx}: missing title`);
		assert.ok(ARSENAL_PLATFORMS.includes(item.platform), `${ctx}: invalid platform`);
		assert.ok(ARSENAL_CATEGORIES.includes(item.category), `${ctx}: invalid category`);
		assert.ok(["wand", "inventory"].includes(item.tier), `${ctx}: invalid tier`);
		assert.ok(item.icon, `${ctx}: missing icon`);
		assert.ok(item.homepageUrl, `${ctx}: missing homepageUrl`);
		assert.ok(/^https?:\/\//.test(item.homepageUrl), `${ctx}: homepageUrl must be absolute`);
		assert.ok(item.role?.en && item.role?.vi, `${ctx}: role must have both en and vi`);
		assert.ok(ARSENAL_FREQUENCIES.includes(item.frequency), `${ctx}: invalid frequency`);

		const expectedExt = expectedIconExt[item.platform];
		const expectedPrefix = `/arsenal/icons/${item.platform}/${item.slug}.${expectedExt}`;
		assert.equal(
			item.icon,
			expectedPrefix,
			`${ctx}: icon path must be ${expectedPrefix}`,
		);
	}
});

test("every wand-tier entry has a bilingual note", () => {
	const wands = arsenal.filter((i: ArsenalItem) => i.tier === "wand");
	for (const w of wands) {
		assert.ok(w.note?.en && w.note?.vi, `wand ${w.slug}: must have bilingual note`);
		assert.ok(w.note.en.length >= 60, `wand ${w.slug}: en note feels too short`);
		assert.ok(w.note.vi.length >= 60, `wand ${w.slug}: vi note feels too short`);
	}
});

test("slugs are unique across the arsenal", () => {
	const seen = new Set<string>();
	for (const item of arsenal) {
		assert.ok(!seen.has(item.slug), `duplicate slug: ${item.slug}`);
		seen.add(item.slug);
	}
});

test("at most 12 wand-tier entries", () => {
	const count = arsenal.filter((i: ArsenalItem) => i.tier === "wand").length;
	assert.ok(count <= 12, `too many wands (${count}); cap is 12 — keep it scarce`);
});
