import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";

export const GET: APIRoute = async () => {
	const { entries: posts } = await getEmDashCollection("posts");
	const { entries: pages } = await getEmDashCollection("pages");

	const site = "https://huuloc.com";

	const staticPages = [
		{ loc: `${site}/`, priority: "1.0" },
		{ loc: `${site}/pensieve/`, priority: "0.9" },
		{ loc: `${site}/pensieve/categories`, priority: "0.6" },
		{ loc: `${site}/room-of-requirement`, priority: "0.7" },
		{ loc: `${site}/room-of-requirement/priori-incantatem`, priority: "0.7" },
		{ loc: `${site}/${encodeURIComponent("Trương")}`, priority: "0.8" },
	];

	const postEntries = posts
		.filter((p) => p.data.status === "published")
		.map((p) => ({
			loc: `${site}/pensieve/memories/${p.id}`,
			lastmod: p.data.updatedAt?.toISOString() ?? p.data.publishedAt?.toISOString(),
			priority: "0.7",
		}));

	const pageEntries = pages
		.filter((p) => p.data.status === "published")
		.map((p) => ({
			loc: `${site}/pensieve/pages/${p.id}`,
			lastmod: p.data.updatedAt?.toISOString(),
			priority: "0.5",
		}));

	const allEntries = [...staticPages, ...postEntries, ...pageEntries];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries
	.map(
		(e) => `  <url>
    <loc>${e.loc}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}
    <priority>${e.priority}</priority>
  </url>`,
	)
	.join("\n")}
</urlset>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
