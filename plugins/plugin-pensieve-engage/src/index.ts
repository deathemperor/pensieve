import type { PluginDescriptor } from "emdash";

export function pensieveEngagePlugin(): PluginDescriptor {
	return {
		id: "pensieve-engage",
		version: "2.0.0",
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
			// reading_events holds every beacon event — pageview, scroll
			// milestones, heartbeat, leave, outbound, email_open, email_click.
			// `path` is the universal key for site-wide analytics; `postSlug`
			// is the legacy post-only key, derived from path when the URL
			// matches /pensieve/memories/:slug.
			reading_events: {
				indexes: ["path", "postSlug", "sessionId", "country", "eventType", "createdAt"],
			},
			lumos: {
				indexes: ["postSlug", "ipHash"],
			},
		},
		adminPages: [
			{ path: "/subscribers", label: "Subscribers", icon: "users" },
			{ path: "/sends", label: "Sends", icon: "mail" },
			{ path: "/analytics", label: "Analytics", icon: "chart" },
			{ path: "/analytics/pages", label: "Pages", icon: "file" },
			{ path: "/analytics/referrers", label: "Referrers", icon: "link" },
			{ path: "/analytics/audience", label: "Audience", icon: "globe" },
			{ path: "/analytics/live", label: "Live", icon: "activity" },
		],
		adminWidgets: [
			{ id: "subscriber-stats", title: "Subscribers", size: "third" },
			{ id: "traffic-stats", title: "Traffic (24h)", size: "third" },
			{ id: "top-pages-today", title: "Top Pages Today", size: "third" },
		],
	};
}
