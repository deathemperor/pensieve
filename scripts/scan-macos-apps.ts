#!/usr/bin/env tsx
// scripts/scan-macos-apps.ts
//
// Scans /Applications and ~/Applications, extracts icons via `sips`,
// reads kMDItemLastUsedDate via `mdls`, and emits a draft TS block of
// ArsenalItem entries. Output is piped or pasted into src/data/arsenal.ts
// and hand-edited (role lines, note paragraphs, wand-tier picks).
//
// Subprocess safety: all execFileSync calls use array args — never
// template-literal interpolation into a shell. App paths from
// readdirSync can contain quotes/backticks.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, extname } from "node:path";

const ICON_OUT = "public/arsenal/icons/macos";
const APP_DIRS = ["/Applications", join(homedir(), "Applications")];

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/\.app$/, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function lastUsedDate(appPath: string): string | null {
	try {
		const out = execFileSync("mdls", [
			"-name",
			"kMDItemLastUsedDate",
			"-raw",
			appPath,
		]).toString().trim();
		if (out === "(null)" || out === "") return null;
		return new Date(out).toISOString();
	} catch {
		return null;
	}
}

function bucketFrequency(iso: string | null): "today" | "this_week" | "this_month" | "rare" {
	if (!iso) return "rare";
	const ms = Date.now() - new Date(iso).getTime();
	const day = 86_400_000;
	if (ms < day) return "today";
	if (ms < 7 * day) return "this_week";
	if (ms < 30 * day) return "this_month";
	return "rare";
}

function extractIcon(appPath: string, slug: string): boolean {
	const resourcesDir = join(appPath, "Contents", "Resources");
	if (!existsSync(resourcesDir)) return false;
	const icns = readdirSync(resourcesDir).find((f) => f.endsWith(".icns"));
	if (!icns) return false;
	const icnsPath = join(resourcesDir, icns);
	const outPath = join(ICON_OUT, `${slug}.png`);
	try {
		// Array args — no shell, no injection vector.
		execFileSync(
			"sips",
			["-s", "format", "png", "-Z", "256", icnsPath, "--out", outPath],
			{ stdio: "ignore" },
		);
		return true;
	} catch {
		return false;
	}
}

function main() {
	mkdirSync(ICON_OUT, { recursive: true });

	const apps: { name: string; path: string; lastUsed: string | null }[] = [];
	for (const dir of APP_DIRS) {
		if (!existsSync(dir)) continue;
		for (const entry of readdirSync(dir)) {
			if (!entry.endsWith(".app")) continue;
			const fullPath = join(dir, entry);
			try {
				if (!statSync(fullPath).isDirectory()) continue;
			} catch {
				continue;
			}
			apps.push({
				name: entry,
				path: fullPath,
				lastUsed: lastUsedDate(fullPath),
			});
		}
	}

	apps.sort((a, b) => {
		if (!a.lastUsed && !b.lastUsed) return a.name.localeCompare(b.name);
		if (!a.lastUsed) return 1;
		if (!b.lastUsed) return -1;
		return b.lastUsed.localeCompare(a.lastUsed);
	});

	console.log("// === DRAFT macOS entries — hand-curate before pasting into arsenal.ts ===");
	for (const app of apps) {
		const title = basename(app.name, extname(app.name));
		const slug = slugify(app.name);
		const iconOk = extractIcon(app.path, slug);
		const freq = bucketFrequency(app.lastUsed);
		console.log(`  {
    slug: ${JSON.stringify(slug)},
    title: ${JSON.stringify(title)},
    platform: "macos",
    category: "FIXME",
    tier: "inventory",
    icon: ${JSON.stringify(`/arsenal/icons/macos/${slug}.png`)},${iconOk ? "" : "  // FIXME: icon extraction failed"}
    homepageUrl: "https://FIXME",
    role: { en: "FIXME", vi: "FIXME" },
    frequency: ${JSON.stringify(freq)},${app.lastUsed ? `\n    lastUsedAt: ${JSON.stringify(app.lastUsed)},` : ""}
  },`);
	}
	console.log(`// === ${apps.length} apps emitted ===`);
}

main();
