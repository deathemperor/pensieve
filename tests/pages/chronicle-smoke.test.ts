import { test } from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";

const BASE = process.env.CHRONICLE_SMOKE_URL ?? "http://localhost:4321";

async function count(page: import("puppeteer").Page, selector: string): Promise<number> {
	return page.evaluate((s) => document.querySelectorAll(s).length, selector);
}

async function textOf(page: import("puppeteer").Page, selector: string): Promise<string | null> {
	return page.evaluate((s) => document.querySelector(s)?.textContent ?? null, selector);
}

test("chronicle page renders 8 stars and 8 entries", async () => {
	const browser = await puppeteer.launch({ headless: "shell" });
	try {
		const page = await browser.newPage();
		await page.goto(`${BASE}/pensieve/chronicle`, { waitUntil: "networkidle0", timeout: 15_000 });
		const starCount = await count(page, ".cc-star");
		const entryCount = await count(page, ".cc-entry");
		assert.equal(starCount, 8, `expected 8 stars, got ${starCount}`);
		assert.equal(entryCount, 8, `expected 8 entries, got ${entryCount}`);
	} finally {
		await browser.close();
	}
});

test("clicking a star opens the modal", async () => {
	const browser = await puppeteer.launch({ headless: "shell" });
	try {
		const page = await browser.newPage();
		await page.goto(`${BASE}/pensieve/chronicle`, { waitUntil: "networkidle0", timeout: 15_000 });
		await page.click(".cc-star");
		await page.waitForSelector(".cc-modal[data-open]", { timeout: 2_000 });
		const title = await textOf(page, '.cc-modal [data-slot="title"]');
		assert.ok(title && title.length > 0, `modal title should be populated, got: ${title}`);
	} finally {
		await browser.close();
	}
});

test("chronicle page loads in VI", async () => {
	const browser = await puppeteer.launch({ headless: "shell" });
	try {
		const page = await browser.newPage();
		await page.goto(`${BASE}/pensieve/chronicle?lang=vi`, { waitUntil: "networkidle0", timeout: 15_000 });
		const heading = await textOf(page, "h1");
		assert.match(heading ?? "", /Biên Niên Sử|Tinh Tú/);
	} finally {
		await browser.close();
	}
});
