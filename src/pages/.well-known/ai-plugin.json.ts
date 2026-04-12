import type { APIRoute } from "astro";

export const GET: APIRoute = () => {
	const plugin = {
		schema_version: "v1",
		name_for_human: "Pensieve by Trương Hữu Lộc",
		name_for_model: "pensieve_huuloc",
		description_for_human:
			"Personal blog of Trương Hữu Lộc — long-form narratives in Vietnamese and English about memory, family, fish, startups, and AI.",
		description_for_model:
			"A bilingual personal blog (Vietnamese/English) with 130+ posts across philosophy, science, personal stories, generative AI, startups, and nature. All writing is human-authored. English translations are by Claude. The site code is built entirely by Claude Code. Feeds available at /pensieve/rss.xml (all), /pensieve/rss-en.xml (English), /pensieve/rss-vi.xml (Vietnamese).",
		auth: { type: "none" },
		api: { type: "openapi", url: "https://huuloc.com/pensieve/rss.xml" },
		logo_url: "https://huuloc.com/favicon.svg",
		contact_email: "me@huuloc.com",
		legal_info_url: "https://huuloc.com/Trương",
	};

	return new Response(JSON.stringify(plugin, null, "\t"), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
