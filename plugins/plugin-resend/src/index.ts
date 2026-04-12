import type { PluginDescriptor } from "emdash";

export function resendPlugin(): PluginDescriptor {
	return {
		id: "resend-email",
		version: "1.0.0",
		format: "standard",
		entrypoint: "plugin-resend/sandbox",
		options: {},
		capabilities: ["email:provide", "email:send", "network:fetch", "read:users"],
		allowedHosts: ["api.resend.com"],
		adminPages: [
			{ path: "/settings", label: "Email Settings", icon: "mail" },
		],
	};
}
