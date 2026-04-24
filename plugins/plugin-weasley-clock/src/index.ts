import type { PluginDescriptor } from "emdash";
import pluginRuntime from "./sandbox-entry";

// Native-format plugins must export createPlugin — EmDash imports it from
// the package root (see `virtual:emdash/plugins`). The runtime lives in
// sandbox-entry.ts so the file structure matches the "standard" plugin
// shape for easier future migration; this re-export is the glue.
export function createPlugin() {
	return pluginRuntime;
}

export function weasleyClockPlugin(): PluginDescriptor {
	return {
		id: "weasley-clock",
		version: "0.3.0",
		format: "native",
		entrypoint: "plugin-weasley-clock",
		options: {},
		capabilities: [
			"network:fetch",
		],
		allowedHosts: [
			"accounts.google.com",
			"oauth2.googleapis.com",
			"www.googleapis.com",
		],
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
		adminEntry: "plugin-weasley-clock/admin",
		adminPages: [
			{ path: "/feeds", label: "Calendar Feeds", icon: "calendar" },
		],
	};
}
