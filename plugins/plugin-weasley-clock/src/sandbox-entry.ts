import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

// Plugin shell only — no OAuth / sync / admin routes here.
// Those moved to regular Astro API routes at src/pages/api/weasley-clock/*
// because the plugin sandbox ctx doesn't expose env/secrets, which we need
// for Google OAuth client credentials and our token encryption key.
//
// This file stays as the descriptor's entrypoint so the plugin still
// registers cleanly with EmDash (storage namespaces + adminEntry), but
// has no runtime routes.
export default definePlugin({
	id: "weasley-clock",
	version: "0.3.0",
	// id + version present → definePlugin routes to defineNativePlugin which
	// normalises hook records. Plugin:install is a minimal no-op so the
	// "Standard plugin format requires at least hooks or routes" validator
	// is happy even with no routes.
	capabilities: [],
	allowedHosts: [],
	storage: {
		oauth_accounts: { indexes: ["provider", "account_email", "status"] },
		oauth_calendars: { indexes: ["account_id", "calendar_id", "synced"] },
		oauth_state: { indexes: ["expires_at"] },
		synced_events: {
			indexes: [
				"source_type",
				"gcal_account_id",
				"gcal_calendar_id",
				"starts_at",
				"ends_at",
				"external_uid",
				"deleted",
			],
		},
		availability_rules: { indexes: ["timezone"] },
		bookings: {
			indexes: [
				"meeting_type_id",
				"host_account_id",
				"slot_start_iso",
				"status",
				"cancel_token",
				"reschedule_token",
			],
		},
		api_keys: { indexes: ["hash", "revoked_at"] },
		webhook_endpoints: { indexes: ["active"] },
	},
	hooks: {
		"plugin:install": {
			handler: async (_event: unknown, ctx: PluginContext) => {
				ctx.log.info("weasley-clock: plugin installed (shell only; logic in /api/weasley-clock/*)");

				// Idempotently seed the default availability rule.
				const existing = await ctx.storage.availability_rules.get("default");
				if (existing) {
					ctx.log.info("weasley-clock: default availability rule already exists — skipping seed");
					return;
				}

				const defaultRule: {
					label: string;
					timezone: string;
					weekly_hours: {
						mon: { start: string; end: string }[];
						tue: { start: string; end: string }[];
						wed: { start: string; end: string }[];
						thu: { start: string; end: string }[];
						fri: { start: string; end: string }[];
						sat: { start: string; end: string }[];
						sun: { start: string; end: string }[];
					};
				} = {
					label: "Default — daily 09:00-17:30 ICT",
					timezone: "Asia/Ho_Chi_Minh",
					weekly_hours: {
						mon: [{ start: "09:00", end: "17:30" }],
						tue: [{ start: "09:00", end: "17:30" }],
						wed: [{ start: "09:00", end: "17:30" }],
						thu: [{ start: "09:00", end: "17:30" }],
						fri: [{ start: "09:00", end: "17:30" }],
						sat: [{ start: "09:00", end: "17:30" }],
						sun: [{ start: "09:00", end: "17:30" }],
					},
				};

				await ctx.storage.availability_rules.put("default", defaultRule);
				ctx.log.info("weasley-clock: seeded default availability rule (09:00-17:30 ICT, daily)");
			},
		},
	},
});
