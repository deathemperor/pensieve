#!/usr/bin/env tsx
// scripts/scan-cli-tools.ts
//
// Lists CLI tools from `brew list --formula`, walks ~/.local/bin and
// ~/.cargo/bin, then ranks by frequency in ~/.zsh_history. For each
// survivor, fetches a simple-icons SVG; if absent, emits a monogram
// fallback. Output is a draft TS block.

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
	statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ICON_OUT = "public/arsenal/icons/cli";
const HISTORY_PATH = join(homedir(), ".zsh_history");
const MIN_USE_COUNT = 3;
const SIMPLE_ICONS_BASE = "https://cdn.jsdelivr.net/npm/simple-icons@14/icons";

function brewFormulae(): string[] {
	try {
		return execFileSync("brew", ["list", "--formula"])
			.toString()
			.trim()
			.split("\n")
			.filter(Boolean);
	} catch {
		return [];
	}
}

function localBins(): string[] {
	const dirs = [join(homedir(), ".local/bin"), join(homedir(), ".cargo/bin")];
	const results: string[] = [];
	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		for (const entry of readdirSync(dir)) {
			try {
				const full = join(dir, entry);
				const stat = statSync(full);
				if (stat.isFile() && stat.mode & 0o111) results.push(entry);
			} catch {}
		}
	}
	return results;
}

function historyFrequency(): Map<string, number> {
	const counts = new Map<string, number>();
	if (!existsSync(HISTORY_PATH)) return counts;
	// zsh history can contain non-UTF8 bytes; decode loosely.
	const lines = readFileSync(HISTORY_PATH, { encoding: "latin1" }).split("\n");
	const sample = lines.slice(-10_000); // last ~10k commands
	for (const line of sample) {
		// zsh extended history: ": <ts>:<elapsed>;<command>"
		const cmd = line.includes(";") ? line.slice(line.indexOf(";") + 1) : line;
		const first = cmd.trim().split(/\s+/)[0];
		if (!first) continue;
		const tool = first.replace(/^sudo$/, ""); // sudo prefix gets unwrapped
		if (!tool) continue;
		counts.set(tool, (counts.get(tool) ?? 0) + 1);
	}
	return counts;
}

function bucketFromRank(rank: number): "today" | "this_week" | "this_month" | "rare" {
	if (rank < 10) return "today";
	if (rank < 30) return "this_week";
	if (rank < 80) return "this_month";
	return "rare";
}

async function fetchSimpleIcon(slug: string): Promise<string | null> {
	try {
		const res = await fetch(`${SIMPLE_ICONS_BASE}/${slug}.svg`);
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}

function monogramSvg(letter: string): string {
	const ch = (letter[0] ?? "?").toUpperCase();
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="currentColor" opacity="0.12"/><text x="12" y="16" font-family="Inter Tight, sans-serif" font-size="13" font-weight="600" text-anchor="middle" fill="currentColor">${ch}</text></svg>`;
}

async function main() {
	mkdirSync(ICON_OUT, { recursive: true });

	const candidates = new Set<string>([...brewFormulae(), ...localBins()]);
	const counts = historyFrequency();

	// Rank by usage count; drop anything below MIN_USE_COUNT
	const ranked = [...candidates]
		.map((tool) => ({ tool, count: counts.get(tool) ?? 0 }))
		.filter((r) => r.count >= MIN_USE_COUNT)
		.sort((a, b) => b.count - a.count);

	console.log(
		`// === DRAFT CLI entries (${ranked.length} survivors of ${candidates.size}) ===`,
	);
	for (let i = 0; i < ranked.length; i++) {
		const { tool, count } = ranked[i];
		const slug = tool.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		let svg = await fetchSimpleIcon(slug);
		if (!svg) svg = monogramSvg(tool);
		writeFileSync(join(ICON_OUT, `${slug}.svg`), svg);
		const freq = bucketFromRank(i);
		console.log(`  {
    slug: ${JSON.stringify(slug)},
    title: ${JSON.stringify(tool)},
    platform: "cli",
    category: "FIXME",
    tier: "inventory",
    icon: ${JSON.stringify(`/arsenal/icons/cli/${slug}.svg`)},
    homepageUrl: "https://FIXME",
    role: { en: "FIXME", vi: "FIXME" },
    frequency: ${JSON.stringify(freq)},  // count=${count}
  },`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
