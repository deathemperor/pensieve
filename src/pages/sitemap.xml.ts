import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import siteRoutes from "../data/site-routes.json";

export const GET: APIRoute = async () => {
	const site = "https://huuloc.com";

	// Static pages from manifest
	const staticEntries = siteRoutes.static.map((r) => ({
		loc: `${site}${r.path}`,
		priority: r.priority,
	}));

	// Dynamic content from EmDash database (automated, like RSS)
	const collectionEntries = await Promise.all(
		Object.entries(siteRoutes.collections).map(async ([name, config]) => {
			try {
				const { entries } = await getEmDashCollection(name);
				return entries
					.filter((e) => e.data.status === "published")
					.map((e) => ({
						loc: `${site}${config.basePath}/${e.id}`,
						lastmod: e.data.updatedAt?.toISOString() ?? e.data.publishedAt?.toISOString(),
						priority: config.priority,
					}));
			} catch {
				return [];
			}
		}),
	);

	const allEntries = [...staticEntries, ...collectionEntries.flat()];

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
