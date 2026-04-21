import type { Theme } from "./types";
import { naturalPonds } from "./natural-ponds";
import { rocketScience } from "./rocket-science";
import { philosophersSalon } from "./philosophers-salon";
import { neuralNet } from "./neural-net";
import { campfire } from "./campfire";
import { labNotebook } from "./lab-notebook";
import { oakLibrary } from "./oak-library";

export const themes = {
	"natural-ponds": naturalPonds,
	"rocket-science": rocketScience,
	"philosophers-salon": philosophersSalon,
	"neural-net": neuralNet,
	campfire: campfire,
	"lab-notebook": labNotebook,
	"oak-library": oakLibrary,
} satisfies Record<string, Theme>;

export type ThemeSlug = keyof typeof themes;

export const allThemes: Theme[] = Object.values(themes);

export function getTheme(slug: string | null | undefined): Theme | null {
	if (!slug) return null;
	return (themes as Record<string, Theme>)[slug] ?? null;
}

export type { Theme } from "./types";
