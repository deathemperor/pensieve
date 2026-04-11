import type { Theme } from "./types";

export const philosophersSalon: Theme = {
	slug: "philosophers-salon",
	label: "Philosopher's Salon",
	tagline: "candlelight on parchment",
	palette: {
		bg: "#faf5ea",
		bgSubtle: "#f3ecd9",
		text: "#2a1f14",
		textSecondary: "#4f3d2a",
		muted: "#8c7657",
		border: "#e2d4b0",
		borderSubtle: "#ede3c4",
		surface: "#f0e6cf",
		accent: "#8a4a1e",
		accentHover: "#6b370f",
		onAccent: "#faf5ea",
	},
	darkPalette: {
		bg: "#1a130a",
		bgSubtle: "#1f1811",
		text: "#e8dcc2",
		textSecondary: "#b8a87f",
		muted: "#7a6a48",
		border: "#2e2415",
		borderSubtle: "#231a0e",
		surface: "#251d10",
		accent: "#d17a3e",
		accentHover: "#e69158",
	},
	fonts: {
		sans: "'EB Garamond', Georgia, 'Times New Roman', serif",
		mono: "'JetBrains Mono', ui-monospace, monospace",
		googleFontsHref:
			"https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400&display=swap",
	},
	backgroundCSS:
		"radial-gradient(ellipse at center, #faf5ea 0%, #f3ecd9 60%, #ead9af 100%)",
};
