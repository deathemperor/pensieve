import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

async function buildSettingsPage(ctx: PluginContext) {
	const fromEmail =
		(await ctx.kv.get<string>("settings:fromEmail")) ?? "Pensieve <noreply@huuloc.com>";
	const notifyEmail =
		(await ctx.kv.get<string>("settings:notifyEmail")) ?? "deathemperor@gmail.com";
	const hasApiKey = !!(await ctx.kv.get<string>("settings:apiKey"));

	return {
		blocks: [
			{ type: "header", text: "Email Settings" },
			{
				type: "context",
				text: "Send emails via Resend. Get an API key at resend.com/api-keys.",
			},
			{
				type: "fields",
				fields: [
					{ label: "Status", value: hasApiKey ? "Configured" : "API key required" },
					{ label: "From", value: fromEmail },
					{ label: "Comment alerts", value: notifyEmail || "Disabled" },
				],
			},
			{ type: "divider" },
			{
				type: "form",
				block_id: "resend-settings",
				fields: [
					{
						type: "secret_input",
						action_id: "apiKey",
						label: "Resend API Key",
					},
					{
						type: "text_input",
						action_id: "fromEmail",
						label: "From Address",
						initial_value: fromEmail,
					},
					{
						type: "text_input",
						action_id: "notifyEmail",
						label: "Comment Notification Recipient",
						initial_value: notifyEmail,
					},
				],
				submit: { label: "Save", action_id: "save_settings" },
			},
		],
	};
}

export default definePlugin({
	hooks: {
		"plugin:install": {
			handler: async (_event: unknown, ctx: PluginContext) => {
				await ctx.kv.set("settings:fromEmail", "Pensieve <noreply@huuloc.com>");
				await ctx.kv.set("settings:notifyEmail", "deathemperor@gmail.com");
			},
		},

		"email:deliver": {
			exclusive: true,
			handler: async (event: any, ctx: PluginContext) => {
				const apiKey = await ctx.kv.get<string>("settings:apiKey");
				if (!apiKey) {
					throw new Error(
						"Resend API key not configured — go to Admin > Plugins > Resend Email > Settings",
					);
				}

				const from =
					(await ctx.kv.get<string>("settings:fromEmail")) ??
					"Pensieve <noreply@huuloc.com>";

				const { message } = event;

				const res = await ctx.http!.fetch("https://api.resend.com/emails", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						from,
						to: message.to,
						subject: message.subject,
						text: message.text,
						...(message.html && { html: message.html }),
					}),
				});

				if (!res.ok) {
					const body = await res.text();
					throw new Error(`Resend API error (${res.status}): ${body}`);
				}

				ctx.log.info(`Email sent to ${message.to}: "${message.subject}"`);
			},
		},

		"comment:afterCreate": {
			errorPolicy: "continue" as const,
			handler: async (event: any, ctx: PluginContext) => {
				const notifyEmail = await ctx.kv.get<string>("settings:notifyEmail");
				if (!notifyEmail || !ctx.email) return;

				const { comment, content } = event;
				const title = content.title || `${content.collection}/${content.slug}`;

				const excerpt =
					comment.body.length > 500
						? comment.body.slice(0, 500) + "..."
						: comment.body;

				await ctx.email.send(
					{
						to: notifyEmail,
						subject: `[Pensieve] New comment on "${title}"`,
						text: [
							`${comment.authorName} commented on "${title}":`,
							"",
							excerpt,
							"",
							`Status: ${comment.status}`,
							`View in admin: https://huuloc.com/pensieve/_emdash/admin/comments`,
						].join("\n"),
					},
					"resend-email",
				);
			},
		},
	},

	routes: {
		admin: {
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const interaction = routeCtx.input;

				if (interaction.type === "page_load" && interaction.page === "/settings") {
					return buildSettingsPage(ctx);
				}

				if (
					interaction.type === "form_submit" &&
					interaction.action_id === "save_settings"
				) {
					const values = interaction.values ?? {};
					if (typeof values.apiKey === "string" && values.apiKey !== "") {
						await ctx.kv.set("settings:apiKey", values.apiKey);
					}
					if (typeof values.fromEmail === "string") {
						await ctx.kv.set("settings:fromEmail", values.fromEmail);
					}
					if (typeof values.notifyEmail === "string") {
						await ctx.kv.set("settings:notifyEmail", values.notifyEmail);
					}
					return {
						...(await buildSettingsPage(ctx)),
						toast: { message: "Settings saved", type: "success" },
					};
				}

				return { blocks: [] };
			},
		},
	},
});
