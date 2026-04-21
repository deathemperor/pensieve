import type { PluginDescriptor } from "emdash";

export function pensieveEngagePlugin(): PluginDescriptor {
	return {
		id: "pensieve-engage",
		version: "1.0.0",
		format: "standard",
		entrypoint: "plugin-pensieve-engage/sandbox",
		options: {},
		capabilities: [
			"email:send",
			"read:content",
			"read:users",
			"network:fetch",
			// page:inject is required for the page:fragments hook that injects
			// the reading-analytics beacon. Without it the hook is silently
			// skipped at registration, so no pageviews were ever recorded.
			"page:inject",
		],
		allowedHosts: ["api.resend.com"],
		storage: {
			subscribers: {
				indexes: ["email", "status", "createdAt"],
			},
			email_sends: {
				indexes: ["postSlug", "status", "sentAt"],
			},
			reading_events: {
				indexes: ["postSlug", "sessionId", "createdAt"],
			},
			lumos: {
				indexes: ["postSlug", "ipHash"],
			},
		},
		adminPages: [
			{ path: "/subscribers", label: "Subscribers", icon: "users" },
			{ path: "/sends", label: "Sends", icon: "mail" },
			{ path: "/analytics", label: "Analytics", icon: "chart" },
		],
		adminWidgets: [
			{ id: "subscriber-stats", title: "Subscribers", size: "third" },
		],
	};
}
