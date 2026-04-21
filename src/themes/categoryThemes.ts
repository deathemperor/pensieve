import { themes, getTheme, type ThemeSlug, type Theme } from "./index";

export const categoryThemeMap: Record<string, ThemeSlug> = {
	philosophy: "philosophers-salon",
	science: "lab-notebook",
	"personal-stories": "campfire",
	"generative-ai": "neural-net",
	startups: "rocket-science",
	nature: "natural-ponds",
	education: "oak-library",
	misc: "lab-notebook",
};

export const defaultThemeSlug: ThemeSlug = "lab-notebook";

export function themeForCategory(categorySlug: string | null | undefined): Theme {
	if (!categorySlug) return themes[defaultThemeSlug];
	const slug = categoryThemeMap[categorySlug] ?? defaultThemeSlug;
	return themes[slug];
}

export function themeForFirstCategory(
	categorySlugs: readonly string[] | null | undefined
): Theme {
	if (!categorySlugs || categorySlugs.length === 0) {
		return themes[defaultThemeSlug];
	}
	return themeForCategory(categorySlugs[0]);
}

export { getTheme, themes, type Theme, type ThemeSlug };
