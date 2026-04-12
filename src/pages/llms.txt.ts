import type { APIRoute } from "astro";
import siteRoutes from "../data/site-routes.json";

export const GET: APIRoute = () => {
	const pages = siteRoutes.static
		.filter((r) => r.path !== "/")
		.map((r) => `- ${r.title}: ${r.path}`)
		.join("\n");

	const feeds = siteRoutes.feeds
		.map((r) => `- ${r.title}: ${r.path}`)
		.join("\n");

	const content = `# huuloc.com

> Personal site of Trương Hữu Lộc — senior software engineer, bilingual writer, fishkeeper. Based in Vietnam.

## Pages
${pages}

## About the Content
- All writing is human-authored by Trương Hữu Lộc
- English translations are by Claude (Anthropic)
- All site code is built by Claude Code (Anthropic's AI coding agent)
- Source: https://github.com/deathemperor/pensieve

## Feeds
${feeds}
- Sitemap: /sitemap.xml

## Contact
- Email: me@huuloc.com
- GitHub: https://github.com/deathemperor
- LinkedIn: https://linkedin.com/in/deathemperor
`;

	return new Response(content, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
