/**
 * pensieve theme system — Linear-influenced.
 *
 * One unified palette site-wide. Each category gets a single refined accent
 * color and a label/tagline. No per-theme typography changes, no per-theme
 * backgrounds — just an accent. Calm and confident, like Linear's blog.
 */

export interface ThemePalette {
	bg: string;
	bgSubtle: string;
	text: string;
	textSecondary: string;
	muted: string;
	border: string;
	borderSubtle: string;
	surface: string;
	accent: string;
	accentHover: string;
	onAccent: string;
}

export interface ThemeFonts {
	sans: string;
	mono: string;
	display?: string;
	googleFontsHref?: string;
}

export interface Theme {
	slug: string;
	label: string;
	tagline: string;
	palette: ThemePalette;
	darkPalette?: Partial<ThemePalette>;
	fonts: ThemeFonts;
	backgroundCSS?: string;
	accentRing?: string;
}

// ============================================================================
// SHARED BASE — every category theme inherits these. Only `accent` differs.
// ============================================================================

export const BASE_PALETTE_LIGHT: Omit<ThemePalette, "accent" | "accentHover" | "onAccent"> = {
	bg: "#fafbfc",
	bgSubtle: "#f4f5f8",
	text: "#08090a",
	textSecondary: "#3d4452",
	muted: "#62676c",
	border: "rgba(8, 9, 10, 0.08)",
	borderSubtle: "rgba(8, 9, 10, 0.05)",
	surface: "#f4f5f8",
};

export const BASE_PALETTE_DARK: Omit<ThemePalette, "accent" | "accentHover" | "onAccent"> = {
	bg: "#08090a",
	bgSubtle: "#101113",
	text: "#f7f8f8",
	textSecondary: "#8a8f98",
	muted: "#62676c",
	border: "rgba(255, 255, 255, 0.06)",
	borderSubtle: "rgba(255, 255, 255, 0.04)",
	surface: "#101113",
};

export const BASE_FONTS: ThemeFonts = {
	sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
	display:
		"'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
	mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
	googleFontsHref:
		"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap",
};

/**
 * Build a Theme object from a single accent color, mixing into the shared
 * base palette + base typography.
 */
export function buildTheme(args: {
	slug: string;
	label: string;
	tagline: string;
	accent: string;
	accentHover: string;
	onAccent?: string;
}): Theme {
	const onAccent = args.onAccent ?? "#08090a";
	return {
		slug: args.slug,
		label: args.label,
		tagline: args.tagline,
		palette: {
			...BASE_PALETTE_LIGHT,
			accent: args.accent,
			accentHover: args.accentHover,
			onAccent,
		},
		darkPalette: {
			...BASE_PALETTE_DARK,
			accent: args.accent,
			accentHover: args.accentHover,
			onAccent,
		},
		fonts: BASE_FONTS,
	};
}
