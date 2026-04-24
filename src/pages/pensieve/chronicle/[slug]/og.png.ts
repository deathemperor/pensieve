export const prerender = false;

import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import { Resvg, initWasm } from "@resvg/resvg-wasm";
// @ts-expect-error — wasm module import has no TS declaration
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm?module";

import { getChronicleCategory } from "../../../../themes/chronicleCategories";
import { generateOgSvg } from "../../../../utils/og-svg";

let wasmReady: Promise<void> | null = null;
let fontBuffer: Uint8Array | null = null;

async function ensureWasm() {
	if (!wasmReady) wasmReady = initWasm(wasmModule as WebAssembly.Module);
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

	const { entries: raw } = await (getEmDashCollection as any)("chronicle");
	const entry = (raw as any[]).find((e) => e.id === slug || e.slug === slug);
	if (!entry) return new Response("Not found", { status: 404 });

	const cat = getChronicleCategory(entry.data.category);
	const title = entry.data.title_en ?? entry.data.title_vi ?? entry.data.title ?? "—";
	const svg = generateOgSvg(title, cat.hex);

	try {
		await ensureWasm();
		const font = await ensureFont(url.origin);
		const resvg = new Resvg(svg, {
			fitTo: { mode: "width", value: 1200 },
			font: {
				fontBuffers: [font],
				defaultFontFamily: "Inter Tight",
				loadSystemFonts: false,
			},
		});
		const png = resvg.render().asPng();
		return new Response(png, {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "public, max-age=86400, s-maxage=604800",
			},
		});
	} catch (err) {
		console.error("chronicle og png render failed:", err);
		return new Response(svg, {
			headers: {
				"Content-Type": "image/svg+xml",
				"Cache-Control": "public, max-age=60",
			},
		});
	}
};
