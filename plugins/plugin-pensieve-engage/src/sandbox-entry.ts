import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

function hashEmail(email: string): string {
	let hash = 0;
	for (let i = 0; i < email.length; i++) {
		const char = email.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return "sub_" + Math.abs(hash).toString(36);
}

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function buildSubscribersPage(ctx: PluginContext) {
	const allSubscribers = await ctx.storage.subscribers.query({});
	const items = allSubscribers.items ?? allSubscribers ?? [];

	const total = items.length;
	const active = items.filter((s: any) => s.status === "active").length;
	const unsubscribed = items.filter((s: any) => s.status === "unsubscribed").length;

	const rows = items.map((s: any) => ({
		cells: [s.email, s.status, s.createdAt ?? "—"],
		actions: [
			{
				label: "Delete",
				action_id: "delete_subscriber",
				value: s.id ?? s.email,
				style: "danger",
			},
		],
	}));

	return {
		blocks: [
			{ type: "header", text: "Subscribers" },
			{
				type: "fields",
				fields: [
					{ label: "Total", value: String(total) },
					{ label: "Active", value: String(active) },
					{ label: "Unsubscribed", value: String(unsubscribed) },
				],
			},
			{ type: "divider" },
			{
				type: "table",
				columns: ["Email", "Status", "Subscribed"],
				rows,
			},
		],
	};
}

export default definePlugin({
	hooks: {
		"plugin:install": {
			handler: async (_event: unknown, ctx: PluginContext) => {
				await ctx.kv.set("settings:welcomeSubject", "Welcome to Pensieve");
				await ctx.kv.set(
					"settings:welcomeBody",
					"Thanks for subscribing to Pensieve! You'll receive updates when new posts are published.",
				);
			},
		},

		"content:afterSave": {
			priority: 200,
			errorPolicy: "continue",
			handler: async (event: any, ctx: PluginContext) => {
				const { collection, content } = event;

				if (collection !== "posts" || content.status !== "published") {
					return;
				}

				if (content.notify_subscribers === false) {
					ctx.log.info(`Newsletter skipped for "${content.title}" — notify_subscribers is false`);
					return;
				}

				const slug = content.slug || content.id;
				const sentKey = `state:sent:${slug}`;
				const alreadySent = await ctx.kv.get(sentKey);

				if (alreadySent) {
					ctx.log.info(`Newsletter already sent for "${content.title}", skipping`);
					return;
				}

				const allSubscribers = await ctx.storage.subscribers.query({});
				const items = allSubscribers.items ?? allSubscribers ?? [];
				const activeSubscribers = items.filter((s: any) => s.status === "active");

				if (activeSubscribers.length === 0) {
					ctx.log.info(`No active subscribers, skipping newsletter for "${content.title}"`);
					return;
				}

				const sendId = `send_${slug}_${Date.now()}`;
				await ctx.storage.email_sends.put(sendId, {
					id: sendId,
					slug,
					title: content.title,
					status: "sending",
					subscriberCount: activeSubscribers.length,
					startedAt: new Date().toISOString(),
				});

				const postUrl = `https://huuloc.com/pensieve/memories/${slug}`;
				const excerpt =
					content.excerpt ||
					(typeof content.content === "string"
						? content.content.slice(0, 200)
						: content.title);

				let sent = 0;
				let failed = 0;

				for (const subscriber of activeSubscribers) {
					const unsubscribeUrl = `https://huuloc.com/_emdash/api/plugins/pensieve-engage/unsubscribe?email=${subscriber.email}`;
					try {
						await ctx.email.send(
							{
								to: subscriber.email,
								subject: `[Pensieve] New memory: ${content.title}`,
								text: [
									`New memory: ${content.title}`,
									"",
									excerpt,
									"",
									`Read more: ${postUrl}`,
									"",
									"---",
									`Unsubscribe: ${unsubscribeUrl}`,
								].join("\n"),
							},
							"pensieve-engage",
						);
						sent++;
					} catch (err) {
						failed++;
						ctx.log.info(`Failed to send newsletter to ${subscriber.email}: ${err}`);
					}
				}

				await ctx.storage.email_sends.put(sendId, {
					id: sendId,
					slug,
					title: content.title,
					status: "completed",
					subscriberCount: activeSubscribers.length,
					sent,
					failed,
					startedAt: new Date().toISOString(),
					completedAt: new Date().toISOString(),
				});

				await ctx.kv.set(sentKey, new Date().toISOString());

				ctx.log.info(
					`Newsletter for "${content.title}" completed: ${sent} sent, ${failed} failed`,
				);
			},
		},
	},

	routes: {
		subscribe: {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const body = await routeCtx.request.json();
				const email = body.email?.trim().toLowerCase();

				if (!email || !isValidEmail(email)) {
					return { error: "Invalid email address" };
				}

				const existing = await ctx.storage.subscribers.query({
					where: { email },
				});
				const existingItems = existing.items ?? existing ?? [];

				if (existingItems.length > 0) {
					const sub = existingItems[0] as any;
					if (sub.status === "active") {
						return { success: true, message: "Already subscribed" };
					}
					// Re-activate unsubscribed user
					await ctx.storage.subscribers.put(sub.id ?? hashEmail(email), {
						...sub,
						status: "active",
					});
					return { success: true, message: "Subscription reactivated" };
				}

				const id = hashEmail(email);
				await ctx.storage.subscribers.put(id, {
					id,
					email,
					status: "active",
					createdAt: new Date().toISOString(),
				});

				const welcomeSubject =
					(await ctx.kv.get<string>("settings:welcomeSubject")) ??
					"Welcome to Pensieve";
				const welcomeBody =
					(await ctx.kv.get<string>("settings:welcomeBody")) ??
					"Thanks for subscribing to Pensieve! You'll receive updates when new posts are published.";

				try {
					await ctx.email.send(
						{
							to: email,
							subject: welcomeSubject,
							text: welcomeBody,
						},
						"pensieve-engage",
					);
				} catch (err) {
					ctx.log.info(`Welcome email failed for ${email}: ${err}`);
				}

				ctx.log.info(`New subscriber: ${email}`);
				return { success: true };
			},
		},

		unsubscribe: {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const url = new URL(routeCtx.request.url);
				const email = url.searchParams.get("email")?.trim().toLowerCase();

				if (!email) {
					return new Response(
						"<html><body><h1>Missing email parameter</h1></body></html>",
						{ headers: { "Content-Type": "text/html" } },
					);
				}

				const existing = await ctx.storage.subscribers.query({
					where: { email },
				});
				const existingItems = existing.items ?? existing ?? [];

				if (existingItems.length > 0) {
					const sub = existingItems[0] as any;
					await ctx.storage.subscribers.put(sub.id ?? hashEmail(email), {
						...sub,
						status: "unsubscribed",
					});
				}

				ctx.log.info(`Unsubscribed: ${email}`);

				return new Response(
					`<html>
<head><title>Unsubscribed</title></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;text-align:center;">
	<h1>Unsubscribed</h1>
	<p>You've been unsubscribed from Pensieve updates.</p>
	<p style="color:#666;">If this was a mistake, you can subscribe again at any time.</p>
</body>
</html>`,
					{ headers: { "Content-Type": "text/html" } },
				);
			},
		},

		admin: {
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const interaction = routeCtx.input;

				if (interaction.type === "page_load" && interaction.page === "/subscribers") {
					return buildSubscribersPage(ctx);
				}

				if (
					interaction.type === "block_action" &&
					interaction.action_id === "delete_subscriber"
				) {
					const subscriberId = interaction.value;
					await ctx.storage.subscribers.delete(subscriberId);
					return {
						...(await buildSubscribersPage(ctx)),
						toast: { message: "Subscriber deleted", type: "success" },
					};
				}

				return { blocks: [] };
			},
		},
	},
});
