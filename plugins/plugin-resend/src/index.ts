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
		admin: {
			settingsSchema: {
				apiKey: {
					type: "secret",
					label: "Resend API Key",
					description: "Get your key from resend.com/api-keys",
				},
				fromEmail: {
					type: "string",
					label: "From Address",
					description:
						"Sender email — must be on a domain verified in Resend",
					default: "Pensieve <noreply@huuloc.com>",
				},
				notifyEmail: {
					type: "string",
					label: "Comment Notification Recipient",
					description: "Where to send new-comment alerts",
					default: "deathemperor@gmail.com",
				},
			},
		},
	};
}
