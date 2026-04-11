import type { Theme } from "./types";

export const labNotebook: Theme = {
	slug: "lab-notebook",
	label: "Lab Notebook",
	tagline: "grid paper, ink blue",
	palette: {
		bg: "#fcfcf7",
		bgSubtle: "#f6f6ee",
		text: "#1a1e2e",
		textSecondary: "#3d4560",
		muted: "#828aa0",
		border: "#d9dce5",
		borderSubtle: "#e8eaef",
		surface: "#f1f2ed",
		accent: "#1e3a8a",
		accentHover: "#0f2769",
		onAccent: "#fcfcf7",
	},
	darkPalette: {
		bg: "#0e1118",
		bgSubtle: "#131722",
		text: "#e2e6f0",
		textSecondary: "#a0a8c0",
		muted: "#5a6484",
		border: "#1d2232",
		borderSubtle: "#161a26",
		surface: "#141824",
		accent: "#7aa5ff",
		accentHover: "#a0beff",
	},
	fonts: {
		sans: "'Inter', -apple-system, 'Segoe UI', sans-serif",
		mono: "'IBM Plex Mono', ui-monospace, monospace",
		googleFontsHref:
			"https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&family=IBM+Plex+Mono:wght@400;500&display=swap",
	},
	backgroundCSS:
		"linear-gradient(#d9dce5 1px, transparent 1px), linear-gradient(90deg, #d9dce5 1px, transparent 1px), #fcfcf7",
};
