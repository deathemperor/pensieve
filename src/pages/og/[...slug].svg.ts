export const prerender = false;

import type { APIRoute } from "astro";
import { getEmDashEntry, getEntryTerms } from "emdash";
import {
	categoryThemeMap,
	defaultThemeSlug,
} from "../../themes/categoryThemes";
import { themes } from "../../themes/index";

// ── Text-wrapping helpers ──────────────────────────────────────────
// SVG <text> has no auto-wrap, so we split the title into lines manually.
// ~28 chars per line at 48px in Inter keeps it inside the safe area.

const MAX_CHARS_PER_LINE = 28;
const MAX_LINES = 3;

function wrapTitle(title: string): string[] {
	const words = title.split(/\s+/);
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (candidate.length > MAX_CHARS_PER_LINE && current) {
			lines.push(current);
			current = word;
			if (lines.length >= MAX_LINES) break;
		} else {
			current = candidate;
		}
	}

	if (lines.length < MAX_LINES && current) {
		lines.push(current);
	}

	// Truncate the last line with ellipsis if there was leftover text
	if (lines.length === MAX_LINES) {
		const last = lines[MAX_LINES - 1];
		if (current && !lines.includes(current)) {
			// There are remaining words — add ellipsis
			lines[MAX_LINES - 1] =
				last.length > MAX_CHARS_PER_LINE - 1
					? last.slice(0, MAX_CHARS_PER_LINE - 1) + "\u2026"
					: last + "\u2026";
		} else if (last.length > MAX_CHARS_PER_LINE) {
			lines[MAX_LINES - 1] =
				last.slice(0, MAX_CHARS_PER_LINE - 1) + "\u2026";
		}
	}

	return lines;
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

// ── SVG generation ─────────────────────────────────────────────────

function generateOgSvg(title: string, accent: string): string {
	const lines = wrapTitle(title);

	// Title starts at y=260 with 64px line height
	const titleTspans = lines
		.map(
			(line, i) =>
				`<tspan x="80" dy="${i === 0 ? 0 : 64}">${escapeXml(line)}</tspan>`,
		)
		.join("\n            ");

	// Position the domain line relative to title
	const titleBlockBottom = 260 + (lines.length - 1) * 64;
	const domainY = Math.max(titleBlockBottom + 72, 520);

	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <!-- Accent gradient glow in bottom-right -->
    <radialGradient id="glow" cx="0.85" cy="0.75" r="0.6">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.18" />
      <stop offset="60%" stop-color="${accent}" stop-opacity="0.04" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
    <!-- Subtle top-left ambient glow -->
    <radialGradient id="ambient" cx="0.1" cy="0.15" r="0.55">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.06" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#08090a" />
  <rect width="1200" height="630" fill="url(#glow)" />
  <rect width="1200" height="630" fill="url(#ambient)" />

  <!-- Subtle border -->
  <rect x="0.5" y="0.5" width="1199" height="629" rx="0" fill="none"
        stroke="rgba(255,255,255,0.06)" stroke-width="1" />

  <!-- Pensieve bowl icon (top-left) -->
  <g transform="translate(80, 60) scale(1.5)">
    <ellipse cx="16" cy="10.5" rx="11" ry="2.75"
             fill="none" stroke="${accent}" stroke-width="2.25"
             stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
    <path d="M5 10.5 L5 14 C5 20.5 9.5 25 16 25 C22.5 25 27 20.5 27 14 L27 10.5"
          fill="none" stroke="${accent}" stroke-width="2.25"
          stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
    <ellipse cx="16" cy="10.5" rx="4.5" ry="1.1" fill="${accent}" opacity="0.5" />
  </g>

  <!-- "Pensieve" label next to icon -->
  <text x="136" y="88" fill="${accent}" opacity="0.7"
        font-family="'Inter Tight', 'Inter', -apple-system, sans-serif"
        font-size="18" font-weight="600" letter-spacing="0.08em">PENSIEVE</text>

  <!-- Title -->
  <text y="260" fill="#f7f8f8"
        font-family="'Inter Tight', 'Inter', -apple-system, sans-serif"
        font-size="52" font-weight="700" letter-spacing="-0.02em">
            ${titleTspans}
  </text>

  <!-- Domain / site URL -->
  <text x="80" y="${domainY}" fill="#62676c"
        font-family="'Inter', -apple-system, sans-serif"
        font-size="18" font-weight="400" letter-spacing="0.02em">huuloc.com/pensieve</text>

  <!-- Accent bar at bottom -->
  <rect x="80" y="580" width="60" height="3" rx="1.5" fill="${accent}" opacity="0.5" />
</svg>`;
}

// ── Route handler ──────────────────────────────────────────────────

export const GET: APIRoute = async ({ params }) => {
	const slug = params.slug;
	if (!slug) return new Response("Not found", { status: 404 });

	const { entry: post } = await getEmDashEntry("posts", slug);
	if (!post) return new Response("Not found", { status: 404 });

	const title = post.data.title || "Pensieve";

	// Look up category to derive accent color
	const categories = await getEntryTerms("posts", post.data.id, "category");
	const catSlug = categories[0]?.slug;
	const themeSlug = catSlug
		? (categoryThemeMap[catSlug] ?? defaultThemeSlug)
		: defaultThemeSlug;
	const theme = themes[themeSlug];
	const accent = theme?.palette?.accent ?? "#5e6ad2";

	const svg = generateOgSvg(title, accent);

	return new Response(svg, {
		headers: {
			"Content-Type": "image/svg+xml",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
