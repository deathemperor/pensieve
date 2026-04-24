import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { collections } from "../../../../lib/weasley-clock/storage";
import { isAdmin, forbidden } from "../../../../lib/weasley-clock/auth";

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
	if (!isAdmin(locals)) return forbidden();

	const c = collections((env as any).DB);
	const accounts = await c.oauth_accounts.list();
	const calendars = await c.oauth_calendars.list();

	const accountsList = accounts.map((r) => ({
		id: r.id,
		account_email: r.data.account_email,
		display_name: r.data.display_name,
		status: r.data.status,
		connected_at: r.data.connected_at,
		last_synced_at: r.data.last_synced_at ?? null,
		last_sync_error: r.data.last_sync_error ?? null,
	}));

	const calendarsByAccount: Record<string, any[]> = {};
	for (const r of calendars) {
		const list = calendarsByAccount[r.data.account_id] ?? (calendarsByAccount[r.data.account_id] = []);
		list.push({
			id: r.id,
			calendar_id: r.data.calendar_id,
			summary: r.data.summary,
			time_zone: r.data.time_zone,
			background_color: r.data.background_color,
			synced: !!r.data.synced,
		});
	}

	return new Response(
		JSON.stringify({ accounts: accountsList, calendarsByAccount }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
};
