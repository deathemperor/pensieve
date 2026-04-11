import type { Theme } from "./types";

export const naturalPonds: Theme = {
	slug: "natural-ponds",
	label: "Natural Ponds",
	tagline: "mossy water, stilled at dawn",
	palette: {
		bg: "#f4f8f1",
		bgSubtle: "#e9f1e3",
		text: "#1e2a1c",
		textSecondary: "#3d5238",
		muted: "#7a8e73",
		border: "#cedcc4",
		borderSubtle: "#e3ebdb",
		surface: "#edf4e6",
		accent: "#2f6b3d",
		accentHover: "#1f4f2a",
		onAccent: "#f4f8f1",
	},
	darkPalette: {
		bg: "#0d1710",
		bgSubtle: "#111d14",
		text: "#d8e6d1",
		textSecondary: "#a5bc9b",
		muted: "#6d846a",
		border: "#1f3324",
		borderSubtle: "#162119",
		surface: "#152319",
		accent: "#6fae6e",
		accentHover: "#8dc58a",
	},
	fonts: {
		sans: "'Lora', Georgia, 'Times New Roman', serif",
		mono: "'JetBrains Mono', ui-monospace, monospace",
		googleFontsHref:
			"https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap",
	},
	backgroundCSS:
		"radial-gradient(circle at 20% 10%, rgba(47, 107, 61, 0.06), transparent 55%), radial-gradient(circle at 80% 70%, rgba(47, 107, 61, 0.08), transparent 60%), #f4f8f1",
};
