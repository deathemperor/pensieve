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
