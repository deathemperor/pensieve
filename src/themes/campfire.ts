import type { Theme } from "./types";

export const campfire: Theme = {
	slug: "campfire",
	label: "Campfire",
	tagline: "warm amber, drifting ember",
	palette: {
		bg: "#fff6e8",
		bgSubtle: "#ffedd4",
		text: "#2a1a0c",
		textSecondary: "#5a3a1e",
		muted: "#9e7a53",
		border: "#f3d9a6",
		borderSubtle: "#fae5bd",
		surface: "#ffe8c4",
		accent: "#d94f0a",
		accentHover: "#b53e04",
		onAccent: "#fff6e8",
	},
	darkPalette: {
		bg: "#1a1008",
		bgSubtle: "#22150a",
		text: "#f4e3c8",
		textSecondary: "#caa97a",
		muted: "#8a6a44",
		border: "#322014",
		borderSubtle: "#241810",
		surface: "#2a1b0e",
		accent: "#ff7e2e",
		accentHover: "#ff9650",
	},
	fonts: {
		sans: "'Lora', Georgia, serif",
		mono: "'JetBrains Mono', ui-monospace, monospace",
		googleFontsHref:
			"https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=JetBrains+Mono:wght@400&display=swap",
	},
	backgroundCSS:
		"radial-gradient(ellipse at 50% 100%, rgba(217, 79, 10, 0.14) 0%, transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(255, 164, 45, 0.18) 0%, transparent 45%), #fff6e8",
};
