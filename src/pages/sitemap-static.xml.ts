import type { APIRoute } from "astro";
import siteRoutes from "../data/site-routes.json";

// Static routes sitemap — the site's hand-curated non-CMS pages
// (Room of Requirement, Trương, Hogwarts, etc). EmDash 0.5 owns /sitemap.xml
// as an index of CMS collections; this file covers the rest so search engines
// can still discover the hand-built surface.
//
// robots.txt lists both. Renamed from /sitemap.xml after EmDash started
// shipping its own route at that path (Astro router warned about the
// collision — a future Astro version will hard-error on it).
export const GET: APIRoute = () => {
	const site = "https://huuloc.com";

	const entries = siteRoutes.static.map((r) => ({
		loc: `${site}${r.path}`,
		priority: r.priority,
	}));

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map(
		(e) => `  <url>
    <loc>${e.loc}</loc>
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
