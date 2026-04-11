import type { Theme } from "./types";

export const neuralNet: Theme = {
	slug: "neural-net",
	label: "Neural Net",
	tagline: "dot-matrix over near-black",
	palette: {
		bg: "#08090c",
		bgSubtle: "#0d0f14",
		text: "#e4e7ef",
		textSecondary: "#9ba3b8",
		muted: "#586178",
		border: "#1a1e28",
		borderSubtle: "#121520",
		surface: "#10131c",
		accent: "#4fd5ff",
		accentHover: "#75e0ff",
		onAccent: "#08090c",
	},
	darkPalette: {
		bg: "#08090c",
	},
	fonts: {
		sans: "'Space Grotesk', -apple-system, sans-serif",
		mono: "'IBM Plex Mono', ui-monospace, monospace",
		googleFontsHref:
			"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
	},
	backgroundCSS:
		"radial-gradient(circle at 1px 1px, rgba(79, 213, 255, 0.13) 1px, transparent 0), linear-gradient(135deg, #08090c 0%, #0d0f14 100%)",
};
