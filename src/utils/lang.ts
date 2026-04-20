/**
 * Reader language preference resolution for Pensieve.
 *
 * Each post is stored twice — once in Vietnamese, once in English — linked
 * by a shared `source_id`. Listing pages filter by language, and the
 * individual post page shows a citation banner when the rendered locale
 * differs from the post's `original_language`.
 *
 * Preference order:
 *   1. `pref_lang` cookie (set by the dropdown in the nav)
 *   2. Accept-Language header (from the request)
 *   3. Default: "vi" (most content is originally Vietnamese)
 */

export type Lang = "vi" | "en";

export const DEFAULT_LANG: Lang = "vi";

export function getCurrentLang(astro: {
	url: URL;
	cookies: { get: (name: string) => { value?: string } | undefined };
	request: Request;
}): Lang {
	// 1. Cookie — user's explicit choice from the switcher
	const cookieLang = astro.cookies.get("pref_lang")?.value;
	if (cookieLang === "vi" || cookieLang === "en") return cookieLang;

	// 2. Accept-Language header — OS/browser preference with q-weighted ranking
	const accept = astro.request.headers.get("accept-language") || "";
	const best = pickBestLangFromAccept(accept);
	if (best) return best;

	// 3. Default — most content is originally Vietnamese
	return DEFAULT_LANG;
}

// Parse an Accept-Language header and return the highest-priority (by q-value,
// then by first-appearance) language tag that matches our supported locales.
// Returns null if neither "vi" nor "en" is present anywhere in the header.
// This handles the real-world header shapes the old regex missed:
//   - "fr,en;q=0.8,vi;q=0.5" (prefix doesn't start with a supported lang)
//   - "en;q=0.9,vi;q=0.5"    (first entry has explicit q-value)
//   - "en-US,vi-VN;q=0.9"    (locale-tagged variants)
function pickBestLangFromAccept(header: string): Lang | null {
	if (!header) return null;
	type Entry = { lang: Lang; q: number; order: number };
	const entries: Entry[] = [];
	header.split(",").forEach((chunk, order) => {
		const trimmed = chunk.trim();
		if (!trimmed) return;
		const [tag, ...params] = trimmed.split(";").map((s) => s.trim());
		const base = (tag.split("-")[0] || "").toLowerCase();
		if (base !== "vi" && base !== "en") return;
		let q = 1;
		for (const p of params) {
			const match = /^q\s*=\s*([0-9.]+)$/i.exec(p);
			if (match) {
				const parsed = Number(match[1]);
				if (Number.isFinite(parsed)) q = parsed;
			}
		}
		if (q <= 0) return;
		entries.push({ lang: base as Lang, q, order });
	});
	if (entries.length === 0) return null;
	entries.sort((a, b) => (b.q - a.q) || (a.order - b.order));
	return entries[0].lang;
}

export function otherLang(lang: Lang): Lang {
	return lang === "vi" ? "en" : "vi";
}

export function langLabel(lang: Lang, audience: Lang = lang): string {
	const labels: Record<Lang, Record<Lang, string>> = {
		vi: { vi: "Tiếng Việt", en: "Vietnamese" },
		en: { vi: "Tiếng Anh", en: "English" },
	};
	return labels[lang][audience];
}
