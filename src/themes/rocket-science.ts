import type { Theme } from "./types";

export const rocketScience: Theme = {
	slug: "rocket-science",
	label: "Rocket Science",
	tagline: "deep space, ignition orange",
	palette: {
		bg: "#07091a",
		bgSubtle: "#0c1028",
		text: "#e8ecff",
		textSecondary: "#a8b0d8",
		muted: "#6a7396",
		border: "#1a2048",
		borderSubtle: "#121738",
		surface: "#0f1430",
		accent: "#ff6a1f",
		accentHover: "#ff8c46",
		onAccent: "#07091a",
	},
	darkPalette: {
		bg: "#07091a",
		bgSubtle: "#0c1028",
		text: "#e8ecff",
	},
	fonts: {
		sans: "'Space Grotesk', -apple-system, 'Segoe UI', sans-serif",
		mono: "'JetBrains Mono', ui-monospace, monospace",
		display: "'JetBrains Mono', ui-monospace, monospace",
		googleFontsHref:
			"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
	},
	backgroundCSS:
		"radial-gradient(1.5px 1.5px at 23% 17%, #ffffff 0%, transparent 100%), radial-gradient(1px 1px at 67% 42%, #e8ecff 0%, transparent 100%), radial-gradient(1.2px 1.2px at 43% 68%, #ffffff 0%, transparent 100%), radial-gradient(1px 1px at 88% 88%, #c9d2ff 0%, transparent 100%), radial-gradient(1.5px 1.5px at 12% 91%, #ffffff 0%, transparent 100%), radial-gradient(ellipse at 50% 0%, rgba(255, 106, 31, 0.06), transparent 60%), #07091a",
};
