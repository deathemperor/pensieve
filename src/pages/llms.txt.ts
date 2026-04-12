import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
	const content = `# huuloc.com

> Personal site of Trương Hữu Lộc — senior software engineer, bilingual writer, fishkeeper. Based in Vietnam.

## Sections

### Pensieve (/pensieve/)
Long-form narratives in Vietnamese and English. 130+ posts across categories: philosophy, science, personal stories, generative AI, startups, nature. Originally written on Facebook, rescued and organized here. All writing is human-authored; English translations are by Claude.

### Room of Requirement (/room-of-requirement/)
How this site is built. Architecture overview, tech stack (Astro, EmDash CMS, Cloudflare Workers), and Priori Incantatem — a build diary recording every Claude Code session with model versions.

### Trương (/Trương)
About page. Origin story, profile links, live GitHub activity stats.

## Technical Details
- Built entirely by Claude Code (Anthropic's AI coding agent)
- Content written by human (Trương Hữu Lộc)
- Translations by Claude
- Framework: Astro (SSR) + EmDash CMS
- Hosting: Cloudflare Workers + D1 + R2 + KV
- Source: https://github.com/deathemperor/pensieve

## Feeds
- RSS (all): /pensieve/rss.xml
- RSS (English): /pensieve/rss-en.xml
- RSS (Vietnamese): /pensieve/rss-vi.xml
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
