import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";

/**
 * Personal archive endpoint — dumps the published chronicle as JSON.
 *
 * Shape: { generated_at, count, entries: [ ... ] }
 *
 * Each entry keeps the useful public fields only (titles, subtitles,
 * date, category, location JSON, linked posts, external url). Internal
 * metadata (status, source_id, createdAt) is omitted.
 */
export const GET: APIRoute = async () => {
	const { entries: raw } = await (getEmDashCollection as any)("chronicle");
	const published = (raw as any[])
		.filter((e) => e.data.status !== "draft")
		.sort((a, b) => a.data.event_date.localeCompare(b.data.event_date))
		.map((e) => {
			let location: unknown = null;
			if (e.data.location) {
				try { location = JSON.parse(e.data.location); } catch { /* drop */ }
			}
			return {
				id: e.id,
				slug: e.slug ?? e.id,
				title_en: e.data.title_en ?? null,
				title_vi: e.data.title_vi ?? null,
				subtitle_en: e.data.subtitle_en ?? null,
				subtitle_vi: e.data.subtitle_vi ?? null,
				event_date: e.data.event_date,
				date_precision: e.data.date_precision,
				category: e.data.category,
				location,
				linked_post_slugs: (e.data.linked_post_ids ?? "")
					.split(",")
					.map((s: string) => s.trim())
					.filter(Boolean),
				external_url: e.data.external_url || null,
				external_url_label: e.data.external_url_label || null,
			};
		});

	const body = JSON.stringify(
		{
			generated_at: new Date().toISOString(),
			count: published.length,
			entries: published,
		},
		null,
		2,
	);

	return new Response(body, {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=600",
			"Content-Disposition": 'inline; filename="celestial-chronicle.json"',
		},
	});
};
