import type { PluginDescriptor } from "emdash";

export function weasleyClockPlugin(): PluginDescriptor {
	return {
		id: "weasley-clock",
		version: "0.2.0",
		format: "standard",
		entrypoint: "plugin-weasley-clock/sandbox",
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
