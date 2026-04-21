export const prerender = false;

import type { APIRoute } from "astro";
import { getEmDashEntry, getEntryTerms } from "emdash";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
// Static WASM import — Cloudflare Workers forbid runtime WebAssembly
// compilation, so the binary must be bundled at build time. Astro's
// Cloudflare adapter handles this via a dedicated `?module` loader for
// .wasm assets. initWasm accepts the pre-compiled WebAssembly.Module
// directly (no Response or ArrayBuffer needed).
// @ts-expect-error — wasm module import has no TS declaration
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm?module";

import {
	categoryThemeMap,
	defaultThemeSlug,
} from "../../themes/categoryThemes";
import { themes } from "../../themes/index";
import { generateOgSvg } from "../../utils/og-svg";

// Module-level caches — survive across requests within an isolate so we
// don't re-initialize WASM or re-fetch fonts on every OG render.
let wasmReady: Promise<void> | null = null;
let fontBuffer: Uint8Array | null = null;

async function ensureWasm() {
	if (!wasmReady) {
		wasmReady = initWasm(wasmModule as WebAssembly.Module);
	}
	return wasmReady;
}

async function ensureFont(origin: string): Promise<Uint8Array> {
	if (fontBuffer) return fontBuffer;
	const res = await fetch(`${origin}/fonts/InterTight.ttf`);
	if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
	fontBuffer = new Uint8Array(await res.arrayBuffer());
	return fontBuffer;
}

export const GET: APIRoute = async ({ params, url }) => {
	const slug = params.slug;
	if (!slug) return new Response("Not found", { status: 404 });

	const { entry: post } = await getEmDashEntry("posts", slug);
	if (!post) return new Response("Not found", { status: 404 });

	const title = (post.data.title as string) || "Pensieve";

	const categories = await getEntryTerms("posts", post.data.id, "category");
	const catSlug = categories[0]?.slug;
	const themeSlug = catSlug
		? (categoryThemeMap[catSlug] ?? defaultThemeSlug)
		: defaultThemeSlug;
	const theme = themes[themeSlug];
	const accent = theme?.palette?.accent ?? "#5e6ad2";

	const svg = generateOgSvg(title, accent);

	try {
		await ensureWasm();
		const font = await ensureFont(url.origin);

		const resvg = new Resvg(svg, {
			fitTo: { mode: "width", value: 1200 },
			font: {
				fontBuffers: [font],
				// Variable font covers all weights — resvg interpolates.
				defaultFontFamily: "Inter Tight",
				loadSystemFonts: false,
			},
		});
		const png = resvg.render().asPng();

		return new Response(png, {
			headers: {
				"Content-Type": "image/png",
				// Long cache — post title changes would invalidate by slug.
				"Cache-Control": "public, max-age=86400, s-maxage=604800",
			},
		});
	} catch (err) {
		// On rasterization failure, fall back to the SVG. The SVG at least
		// renders in Twitter summary_large_image cards and in browser tabs.
		console.error("og png render failed:", err);
		return new Response(svg, {
			headers: {
				"Content-Type": "image/svg+xml",
				"Cache-Control": "public, max-age=60",
			},
		});
	}
};
