export const prerender = false;

import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import { getChronicleCategory } from "../../../../themes/chronicleCategories";
import { generateOgSvg } from "../../../../utils/og-svg";

export const GET: APIRoute = async ({ params }) => {
	const slug = params.slug;
	if (!slug) return new Response("Not found", { status: 404 });

	const { entries: raw } = await (getEmDashCollection as any)("chronicle");
	const entry = (raw as any[]).find((e) => e.id === slug || e.slug === slug);
	if (!entry) return new Response("Not found", { status: 404 });

	const cat = getChronicleCategory(entry.data.category);
	const title = entry.data.title_en ?? entry.data.title_vi ?? entry.data.title ?? "—";

	const svg = generateOgSvg(title, cat.hex);
	return new Response(svg, {
		headers: {
			"Content-Type": "image/svg+xml; charset=utf-8",
			"Cache-Control": "public, max-age=600",
		},
	});
};
