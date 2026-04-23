import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

/* ---------------------------------------------------------------
 * Date extraction — inlined copy of src/utils/dateExtract.ts so the
 * sandbox entry has no cross-workspace imports. Keep these two in
 * sync when either changes; the site page and the plugin scanner
 * must recognise the same patterns to stay consistent.
 * --------------------------------------------------------------- */

type DatePrecision = "day" | "month";

interface ExtractedDate {
	isoDate: string;
	precision: DatePrecision;
	context: string;
	matchOffset: number;
}

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
	const r = 25;
	const s = Math.max(0, offset - r);
	const e = Math.min(text.length, offset + matchLen + r);
	return text.slice(s, e).replace(/\s+/g, " ").trim();
}

interface Candidate { isoDate: string; precision: DatePrecision; matchOffset: number; matchText: string }

function collectCandidates(text: string): Candidate[] {
	const out: Candidate[] = [];
	const dmyRe = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g;
	for (const m of text.matchAll(dmyRe)) {
		const iso = isoFromDMY(Number(m[1]), Number(m[2]), Number(m[3]));
		if (iso) out.push({ isoDate: iso, precision: "day", matchOffset: m.index ?? 0, matchText: m[0] });
	}
	const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
	for (const m of text.matchAll(isoRe)) {
		const iso = isoFromDMY(Number(m[3]), Number(m[2]), Number(m[1]));
		if (iso) out.push({ isoDate: iso, precision: "day", matchOffset: m.index ?? 0, matchText: m[0] });
	}
	const viRe = /\btháng\s*(\d{1,2})(?:\s+năm\s+|\/)(\d{4})\b/gi;
	for (const m of text.matchAll(viRe)) {
		const iso = isoFromMY(Number(m[1]), Number(m[2]));
		if (iso) out.push({ isoDate: iso, precision: "month", matchOffset: m.index ?? 0, matchText: m[0] });
	}
	const enRe = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi;
	for (const m of text.matchAll(enRe)) {
		const monthNum = EN_MONTHS[m[1].toLowerCase()];
		const iso = isoFromMY(monthNum, Number(m[2]));
		if (iso) out.push({ isoDate: iso, precision: "month", matchOffset: m.index ?? 0, matchText: m[0] });
	}
	return out;
}

function extractDatesFromPortableText(blocks: unknown): ExtractedDate[] {
	if (!Array.isArray(blocks)) return [];
	const today = todayUtcIso();
	const seen = new Set<string>();
	const results: ExtractedDate[] = [];
	for (const raw of blocks as any[]) {
		if (!raw || raw._type !== "block" || raw.style === "blockquote") continue;
		const children = Array.isArray(raw.children) ? raw.children : [];
		const flat = children
			.filter((c: any) => c && c._type === "span" && typeof c.text === "string")
			.map((c: any) => c.text as string)
			.join("");
		if (!flat) continue;
		const cands = collectCandidates(flat);
		cands.sort((a, b) => a.matchOffset - b.matchOffset);
		for (const c of cands) {
			if (c.isoDate > today) continue;
			const key = `${c.isoDate}:${c.precision}`;
			if (seen.has(key)) continue;
			seen.add(key);
			results.push({
				isoDate: c.isoDate,
				precision: c.precision,
				matchOffset: c.matchOffset,
				context: snippetAround(flat, c.matchOffset, c.matchText.length),
			});
		}
	}
	return results;
}

/* ---------------------------------------------------------------
 * Plugin definition
 * --------------------------------------------------------------- */

export default definePlugin({
	hooks: {
		"content:afterSave": {
			priority: 150,
			errorPolicy: "continue",
			handler: async (event: any, ctx: PluginContext) => {
				const { collection, content } = event;
				if (collection !== "posts") return;
				if (content?.status !== "published") return;

				const slug = content.slug || content.id;
				if (!slug) return;
				const body = content.content;
				if (!body) return;

				const matches = extractDatesFromPortableText(body);
				if (matches.length === 0) return;

				for (const m of matches) {
					const sourceId = `post:${slug}:${m.isoDate}:${m.precision}`;

					// Has this match already been promoted this run or earlier?
					const priorArr = await (ctx.storage as any).scan_log.query({
						filter: { postSlug: slug, isoDate: m.isoDate },
					});
					const prior = Array.isArray(priorArr) ? priorArr : (priorArr?.items ?? []);
					if (prior.length > 0) continue;

					// Cross-collection dedupe: skip if a chronicle row already exists
					// for this exact source_id.
					try {
						const existing = await (ctx as any).content.list?.("chronicle", {
							filter: { source_id: sourceId },
							limit: 1,
						});
						const existingItems = Array.isArray(existing) ? existing : (existing?.items ?? []);
						if (existingItems.length > 0) continue;
					} catch {
						// list() may not be available in older plugin runtimes — proceed
						// with the scan_log guard alone.
					}

					const context = m.context.slice(0, 80);
					const placeholderTitle = `[post-scan] ${m.isoDate} — ${slug}`;
					try {
						await (ctx as any).content.create("chronicle", {
							title: placeholderTitle,
							title_en: placeholderTitle,
							title_vi: placeholderTitle,
							subtitle_en: context,
							subtitle_vi: context,
							event_date: m.isoDate,
							date_precision: m.precision,
							category: "milestone",
							source: "post-scan",
							source_id: sourceId,
							visibility: "public",
							status: "draft",
						});
						ctx.log.info?.(`Chronicle draft queued from ${slug}: ${m.isoDate} (${m.precision})`);
					} catch (err) {
						ctx.log.warn?.(
							`Chronicle draft failed for ${slug} ${m.isoDate}: ${err instanceof Error ? err.message : String(err)}`,
						);
						continue;
					}

					await (ctx.storage as any).scan_log.insert({
						postSlug: slug,
						isoDate: m.isoDate,
						precision: m.precision,
						sourceId,
						createdAt: new Date().toISOString(),
					});
				}
			},
		},
	},
});
