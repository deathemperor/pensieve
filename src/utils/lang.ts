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
	// 1. Cookie
	const cookieLang = astro.cookies.get("pref_lang")?.value;
	if (cookieLang === "vi" || cookieLang === "en") return cookieLang;

	// 2. Accept-Language header
	const accept = astro.request.headers.get("accept-language") || "";
	if (/^en\b/i.test(accept)) return "en";
	if (/^vi\b/i.test(accept)) return "vi";

	// 3. Default
	return DEFAULT_LANG;
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
