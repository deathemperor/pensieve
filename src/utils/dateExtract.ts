/**
 * Date extraction from free-form text and Portable Text blocks.
 *
 * Pure functions, no side effects. Consumed by the chronicle post-scan CLI
 * which reviews a post's body and proposes draft Chronicle entries.
 *
 * Conventions:
 *  - Uses str.match(RE) per project regex rule.
 *  - No new npm deps.
 */

export type DatePrecision = "day" | "month" | "year";

export interface ExtractedDate {
	isoDate: string;       // "YYYY-MM-DD" (for month precision, day = 01; year unused here)
	precision: DatePrecision;
	context: string;       // ~60-char window centered on the match, whitespace-collapsed
	matchOffset: number;   // start offset within the original text
	matchText: string;     // the raw text that matched
}

/* ---------- helpers ---------- */

const EN_MONTHS: Record<string, number> = {
	january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
	july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad2(n: number): string { return String(n).padStart(2, "0"); }

function pad4(n: number): string { return String(n).padStart(4, "0"); }

function isoFromDMY(d: number, m: number, y: number): string | null {
	if (y < 1000 || y > 9999) return null;
	if (m < 1 || m > 12) return null;
	if (d < 1 || d > 31) return null;
	// Calendar round-trip — Feb 30, Apr 31, etc. are rejected.
	const probe = new Date(Date.UTC(y, m - 1, d));
	if (
		probe.getUTCFullYear() !== y ||
		probe.getUTCMonth() !== m - 1 ||
		probe.getUTCDate() !== d
	) return null;
	return `${pad4(y)}-${pad2(m)}-${pad2(d)}`;
}

function isoFromMY(m: number, y: number): string | null {
	if (y < 1000 || y > 9999) return null;
	if (m < 1 || m > 12) return null;
	return `${pad4(y)}-${pad2(m)}-01`;
}

function todayUtcIso(): string {
	const n = new Date();
	return `${pad4(n.getUTCFullYear())}-${pad2(n.getUTCMonth() + 1)}-${pad2(n.getUTCDate())}`;
}

function snippetAround(text: string, offset: number, matchLen: number): string {
	const radius = 25;
	const start = Math.max(0, offset - radius);
	const end = Math.min(text.length, offset + matchLen + radius);
	const raw = text.slice(start, end);
	return raw.replace(/\s+/g, " ").trim();
}

/* ---------- pattern runners ---------- */

interface Candidate {
	isoDate: string;
	precision: DatePrecision;
	matchOffset: number;
	matchText: string;
}

function collectCandidates(text: string): Candidate[] {
	const out: Candidate[] = [];

	// DD/MM/YYYY or D-M-YYYY (Vietnamese convention; day first)
	const dmyRe = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g;
	for (const m of text.matchAll(dmyRe)) {
		const [raw, ds, ms, ys] = m;
		const iso = isoFromDMY(Number(ds), Number(ms), Number(ys));
		if (iso) out.push({ isoDate: iso, precision: "day", matchOffset: m.index ?? 0, matchText: raw });
	}

	// ISO YYYY-MM-DD
	const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
	for (const m of text.matchAll(isoRe)) {
		const [raw, ys, ms, ds] = m;
		const iso = isoFromDMY(Number(ds), Number(ms), Number(ys));
		if (iso) out.push({ isoDate: iso, precision: "day", matchOffset: m.index ?? 0, matchText: raw });
	}

	// Vietnamese tháng M năm YYYY or tháng M/YYYY
	const viRe = /\btháng\s*(\d{1,2})(?:\s+năm\s+|\/)(\d{4})\b/gi;
	for (const m of text.matchAll(viRe)) {
		const [raw, ms, ys] = m;
		const iso = isoFromMY(Number(ms), Number(ys));
		if (iso) out.push({ isoDate: iso, precision: "month", matchOffset: m.index ?? 0, matchText: raw });
	}

	// English Month YYYY
	const enRe = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;
	for (const m of text.matchAll(enRe)) {
		const [raw, monthName, ys] = m;
		const monthNum = EN_MONTHS[monthName.toLowerCase()];
		const iso = isoFromMY(monthNum, Number(ys));
		if (iso) out.push({ isoDate: iso, precision: "month", matchOffset: m.index ?? 0, matchText: raw });
	}

	return out;
}

/* ---------- public API ---------- */

export function extractDatesFromText(text: string): ExtractedDate[] {
	const today = todayUtcIso();
	const seen = new Set<string>();
	const out: ExtractedDate[] = [];

	const candidates = collectCandidates(text);
	// Sort by match offset for deterministic "in text order" output.
	candidates.sort((a, b) => a.matchOffset - b.matchOffset);

	for (const c of candidates) {
		// Drop future dates (for month precision this means the 1st of that month in the future).
		if (c.isoDate > today) continue;
		const key = `${c.isoDate}:${c.precision}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			...c,
			context: snippetAround(text, c.matchOffset, c.matchText.length),
		});
	}
	return out;
}

/* ---------- Portable Text walker ---------- */

interface PortableSpan {
	_type?: string;
	text?: string;
	marks?: string[];
}

interface PortableBlock {
	_type?: string;
	style?: string;
	children?: PortableSpan[];
	[key: string]: unknown;
}

export function extractDatesFromPortableText(blocks: unknown): ExtractedDate[] {
	if (!Array.isArray(blocks)) return [];
	const seen = new Set<string>();
	const today = todayUtcIso();
	const results: ExtractedDate[] = [];

	for (const raw of blocks as PortableBlock[]) {
		if (!raw || raw._type !== "block") continue;
		if (raw.style === "blockquote") continue;
		const children = raw.children ?? [];
		const flat = children
			.filter((c): c is PortableSpan => !!c && c._type === "span" && typeof c.text === "string")
			.map((c) => c.text!)
			.join("");
		if (!flat) continue;

		const perBlock = extractDatesFromText(flat);
		for (const d of perBlock) {
			if (d.isoDate > today) continue;
			const key = `${d.isoDate}:${d.precision}`;
			if (seen.has(key)) continue;
			seen.add(key);
			results.push(d);
		}
	}
	return results;
}
