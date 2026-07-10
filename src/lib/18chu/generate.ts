/**
 * Server-only puzzle generation for "18 Chữ". The word bank (bank.json) and the
 * plaintext answers live here and must never be imported by client code — the
 * browser only ever receives scrambled tiles and salted hashes.
 */
import bank from "./bank.json";

export type PuzzleWord = {
	/** Scrambled tiles, one grapheme each (lowercase; display uppercased). */
	tiles: string[];
	/** Grapheme count of the answer. */
	length: number;
	/** Tile offsets of syllable boundaries — for rendering the gap after solve. */
	splits: number[];
	/** sha256Hex(salt + normalizedAnswer). No plaintext leaves the server. */
	hash: string;
};

export type Puzzle = {
	day: string;
	mode: "daily" | "practice" | "relax";
	seed: string;
	salt: string;
	attribution: string;
	words: PuzzleWord[];
};

const SLOTS: string[][] = bank.slots;
const CORPUS_POOL: string[] = bank.corpusPool ?? [];
const seg = new Intl.Segmenter("vi", { granularity: "grapheme" });

const graphemes = (s: string): string[] => [...seg.segment(s)].map((g) => g.segment);

/** NFC, lowercase, syllables concatenated without space. */
export const normalizeAnswer = (word: string): string =>
	word.normalize("NFC").toLowerCase().replace(/\s+/g, "");

// --- deterministic PRNG (xmur3 seed -> mulberry32 stream) --------------------
function xmur3(str: string): () => number {
	let h = 1779033703 ^ str.length;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	return () => {
		h = Math.imul(h ^ (h >>> 16), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return (h ^= h >>> 16) >>> 0;
	};
}
function mulberry32(a: number): () => number {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const rngFrom = (seed: string) => mulberry32(xmur3(seed)());

async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const buf = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Fisher–Yales with the puzzle's rng; guarantees the shown order differs from
 *  the solved order (so a word never appears already-solved). */
function scramble(solved: string[], rng: () => number): string[] {
	if (solved.length < 2) return [...solved];
	const solvedKey = solved.join("");
	for (let attempt = 0; attempt < 12; attempt++) {
		const a = [...solved];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		if (a.join("") !== solvedKey) return a;
	}
	return [...solved].reverse();
}

/** The ordered answer words for a run — deterministic in (mode, seed). */
export function pickWords(mode: Puzzle["mode"], seed: string): string[] {
	const rng = rngFrom(`${mode}:${seed}`);
	const pick = (pool: string[]) => pool[Math.floor(rng() * pool.length)];
	return SLOTS.map((slot, i) => {
		if (i === SLOTS.length - 1 && CORPUS_POOL.length > 0) return pick(CORPUS_POOL);
		return pick(slot);
	});
}

/** Salt binds hashes to a run so they aren't reusable across days/seeds. */
const saltFor = (mode: Puzzle["mode"], seed: string) => `18chu:${mode}:${seed}`;

export async function buildPuzzle(
	day: string,
	mode: Puzzle["mode"],
	seed: string,
): Promise<Puzzle> {
	const salt = saltFor(mode, seed);
	const rng = rngFrom(`scramble:${mode}:${seed}`);
	const answers = pickWords(mode, seed);

	const words: PuzzleWord[] = await Promise.all(
		answers.map(async (answer) => {
			const solved = graphemes(answer.normalize("NFC")); // includes the space grapheme
			const spaceIdx = solved.indexOf(" ");
			const letterTiles = solved.filter((g) => g !== " ").map((g) => g.toLowerCase());
			return {
				tiles: scramble(letterTiles, rng),
				length: letterTiles.length,
				splits: spaceIdx > 0 ? [spaceIdx] : [],
				hash: await sha256Hex(salt + normalizeAnswer(answer)),
			};
		}),
	);

	return { day, mode, seed, salt, attribution: bank.attribution, words };
}

/** Answer grapheme at a solved-order position — for the hint endpoint. */
export function revealLetter(
	mode: Puzzle["mode"],
	seed: string,
	wordIndex: number,
	pos: number,
): string | null {
	const answers = pickWords(mode, seed);
	const answer = answers[wordIndex];
	if (!answer) return null;
	const letters = graphemes(answer.normalize("NFC")).filter((g) => g !== " ");
	return letters[pos]?.toLowerCase() ?? null;
}
