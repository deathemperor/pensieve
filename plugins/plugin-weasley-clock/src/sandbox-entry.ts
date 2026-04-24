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
	},
	hooks: {
		"plugin:install": {
			handler: async (_event: unknown, ctx: PluginContext) => {
				ctx.log.info("weasley-clock: plugin installed (shell only; logic in /api/weasley-clock/*)");
			},
		},
	},
});
