import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";
import { BASE } from "../../utils/link";

const siteTitle = "The Celestial Chronicle";
const siteDescription = "A life pinned to the sky — events, losses, and milestones as stars.";

export const GET: APIRoute = async ({ site, url }) => {
	const origin = site?.origin ?? url.origin;
	const basePath = BASE.replace(/\/$/, "");
	const chronicleUrl = `${origin}${basePath}/chronicle`;

	const { entries: raw } = await (getEmDashCollection as any)("chronicle");
	const entries = (raw as any[])
		.filter((e) => e.data.status !== "draft")
		.sort((a, b) => b.data.event_date.localeCompare(a.data.event_date))
		.slice(0, 50);

	const items = entries
		.map((e) => {
			const slug = e.slug ?? e.id;
			const itemUrl = `${chronicleUrl}/${slug}`;
			const title = escapeXml(e.data.title_en || e.data.title || "Untitled");
			const description = escapeXml(
				e.data.subtitle_en || e.data.subtitle_vi || `${e.data.event_date}`,
			);
			// Use event_date as pubDate so readers see entries in life-chronology order.
			const pubDate = new Date(`${e.data.event_date}T00:00:00Z`).toUTCString();
			return `    <item>
      <title>${title}</title>
      <link>${itemUrl}</link>
      <guid isPermaLink="true">${itemUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
    </item>`;
		})
		.join("\n");

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <description>${escapeXml(siteDescription)}</description>
    <link>${chronicleUrl}/</link>
    <atom:link href="${chronicleUrl}.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

	return new Response(rss, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

const XML_ESCAPE_PATTERNS = [
	[/&/g, "&amp;"],
	[/</g, "&lt;"],
	[/>/g, "&gt;"],
	[/"/g, "&quot;"],
	[/'/g, "&apos;"],
] as const;

function escapeXml(str: string): string {
	let result = str;
	for (const [pattern, replacement] of XML_ESCAPE_PATTERNS) {
		result = result.replace(pattern, replacement);
	}
	return result;
}
