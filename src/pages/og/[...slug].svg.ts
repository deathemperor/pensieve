export const prerender = false;

import type { APIRoute } from "astro";
import { getEmDashEntry, getEntryTerms } from "emdash";
import {
	categoryThemeMap,
	defaultThemeSlug,
} from "../../themes/categoryThemes";
import { themes } from "../../themes/index";
import { generateOgSvg } from "../../utils/og-svg";

export const GET: APIRoute = async ({ params }) => {
	const slug = params.slug;
	if (!slug) return new Response("Not found", { status: 404 });

	const { entry: post } = await getEmDashEntry("posts", slug);
	if (!post) return new Response("Not found", { status: 404 });

	const title = post.data.title || "Pensieve";

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
