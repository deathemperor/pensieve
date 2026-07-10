/**
 * Build the word bank for the "18 Chữ" game (src/pages/hogwarts/games/18-chu.astro).
 *
 * Source: Hồ Ngọc Đức's Vietnamese word lists, redistributed by
 * https://github.com/duyet/vietnamese-wordlist (GPL). The list *sizes* encode
 * frequency — Viet11K holds the ~11k most common words, Viet22K the next tier,
 * etc. — so "the smallest list a word appears in" is our frequency signal.
 *
 * We keep only clean two-syllable words 5–9 letters long, score each by
 * length + rarity, and split the ranked set into 18 difficulty buckets. The
 * daily puzzle picks one word per bucket, giving a smooth curve from slot 1
 * (short, common) to slot 18 (long, rare).
 *
 * Word 18 is drawn from Lộc's own writing when a corpus dump is present at
 * scripts/.cache/pensieve-corpus.txt (one blob of post text; see README note
 * at the bottom of this file). Absent that, slot 18 falls back to bucket 18.
 *
 * The output (src/lib/18chu/bank.json) is imported ONLY by server routes, so
 * the plaintext answers never reach the browser. Run:  npx tsx scripts/build-18chu-bank.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE = join(__dirname, ".cache");
const OUT = join(__dirname, "..", "src", "lib", "18chu", "bank.json");
const CORPUS_FILE = join(CACHE, "pensieve-corpus.txt");

const LISTS = [
	{ tier: 1, file: "Viet11K.txt" },
	{ tier: 2, file: "Viet22K.txt" },
	{ tier: 3, file: "Viet39K.txt" },
] as const;
const BASE_URL = "https://raw.githubusercontent.com/duyet/vietnamese-wordlist/master";

const BUCKETS = 18;
const MIN_LETTERS = 5;
const MAX_LETTERS = 9;
const MIN_SYLLABLE = 2; // reject 1-letter syllables — their anagram is too easy

const seg = new Intl.Segmenter("vi", { granularity: "grapheme" });

/** Grapheme count, excluding spaces (NFC "ề" counts as one). */
function graphemeLetters(s: string): string[] {
	return [...seg.segment(s.replace(/\s+/g, ""))].map((x) => x.segment);
}

/** A word is a clean 2-syllable candidate iff both syllables are pure
 *  Vietnamese letters ≥ MIN_SYLLABLE graphemes and the total is in range. */
function classify(raw: string): { word: string; letters: number } | null {
	const word = raw.normalize("NFC").trim().toLowerCase();
	const parts = word.split(/\s+/);
	if (parts.length !== 2) return null;
	for (const p of parts) {
		if (!/^\p{L}+$/u.test(p)) return null; // letters only — no digits, hyphens, dots
		if ([...seg.segment(p)].length < MIN_SYLLABLE) return null;
	}
	const letters = graphemeLetters(word).length;
	if (letters < MIN_LETTERS || letters > MAX_LETTERS) return null;
	return { word, letters };
}

async function loadList(file: string): Promise<string[]> {
	// Prefer a local copy in scripts/.cache/ (a single read — no exists-then-read
	// race). Otherwise pull the list into memory; we don't persist fetched bytes
	// to disk. To cache, drop the .txt files into scripts/.cache/ yourself.
	try {
		return readFileSync(join(CACHE, file), "utf8").split("\n");
	} catch {
		/* not cached locally — fall through to network */
	}
	const res = await fetch(`${BASE_URL}/${file}`);
	if (!res.ok) throw new Error(`fetch ${file}: ${res.status}`);
	return (await res.text()).split("\n");
}

async function main() {
	// Assign each candidate its lowest tier (smallest list = most common).
	const tierOf = new Map<string, number>();
	const meta = new Map<string, number>(); // word -> letters
	for (const { tier, file } of LISTS) {
		const lines = await loadList(file);
		for (const line of lines) {
			const c = classify(line);
			if (!c) continue;
			if (!tierOf.has(c.word)) {
				tierOf.set(c.word, tier);
				meta.set(c.word, c.letters);
			}
		}
	}

	// Difficulty score: tile count dominates (it's the visible difficulty), so
	// slots stay monotonic in length; rarity is the tiebreak, pushing common
	// words into early slots and rare ones into late slots of the same length.
	const scored = [...tierOf.keys()]
		.map((word) => ({
			word,
			score: meta.get(word)! * 10 + tierOf.get(word)!,
		}))
		.sort((a, b) => a.score - b.score || a.word.localeCompare(b.word, "vi"));

	const slots: string[][] = Array.from({ length: BUCKETS }, () => []);
	const per = Math.floor(scored.length / BUCKETS);
	for (let i = 0; i < scored.length; i++) {
		const bucket = Math.min(BUCKETS - 1, Math.floor(i / per));
		slots[bucket].push(scored[i].word);
	}

	// Word 18 pool from Lộc's writing, if a corpus dump exists. Read directly and
	// treat a missing file as "no pool" — no exists-then-read race.
	const validSet = new Set(tierOf.keys());
	const corpusPool: string[] = [];
	let corpusText: string | null = null;
	try {
		corpusText = readFileSync(CORPUS_FILE, "utf8").normalize("NFC").toLowerCase();
	} catch {
		/* no corpus dump — slot 18 falls back to bucket 18 */
	}
	if (corpusText) {
		const tokens = corpusText.split(/[^\p{L}]+/u).filter(Boolean);
		const seen = new Set<string>();
		for (let i = 0; i < tokens.length - 1; i++) {
			const pair = `${tokens[i]} ${tokens[i + 1]}`;
			if (validSet.has(pair) && !seen.has(pair)) {
				seen.add(pair);
				corpusPool.push(pair);
			}
		}
	}

	mkdirSync(dirname(OUT), { recursive: true });
	writeFileSync(
		OUT,
		JSON.stringify(
			{
				attribution:
					"Word list: Hồ Ngọc Đức, via github.com/duyet/vietnamese-wordlist (GPL).",
				generatedFrom: LISTS.map((l) => l.file),
				total: scored.length,
				slots,
				corpusPool,
			},
			null,
			0,
		),
	);

	console.log(
		`Wrote ${OUT}\n  ${scored.length} words across ${BUCKETS} buckets ` +
			`(~${per}/bucket)\n  corpusPool: ${corpusPool.length} words` +
			(corpusPool.length ? "" : " (no scripts/.cache/pensieve-corpus.txt — slot 18 uses bucket 18)"),
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

/*
 * To populate word 18 from your own writing, dump published post text to the
 * cache file from an authenticated session, then re-run this script:
 *
 *   npx wrangler d1 execute pensieve-db --remote --json \
 *     --command "SELECT body FROM <posts-table> WHERE status='published'" \
 *     | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(r[0].results.map(x=>x.body).join(" "))' \
 *     > scripts/.cache/pensieve-corpus.txt
 *
 * (Portable Text bodies are JSON; extracting plain text may need a small
 *  flatten step. Any blob of Vietnamese prose works — the script only mines
 *  two-syllable words that are already valid dictionary entries.)
 */
