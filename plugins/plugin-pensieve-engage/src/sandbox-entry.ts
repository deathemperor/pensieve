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
		"page:fragments": {
			handler: async (event: any, ctx: PluginContext) => {
				if (event.page.kind !== "content") return null;
				if (event.page.content?.collection !== "posts") return null;

				const postSlug = event.page.content?.slug || event.page.content?.id;
				const beaconUrl = "/_emdash/api/plugins/pensieve-engage/beacon";

				return {
					kind: "inline-script",
					placement: "body:end",
					code: `(function(){var sid=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);var slug=${JSON.stringify(postSlug)};var url=${JSON.stringify(beaconUrl)};var startTime=Date.now();var maxScroll=0;var docH=function(){return Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)-window.innerHeight};function send(type,extra){var d={postSlug:slug,sessionId:sid,eventType:type,data:Object.assign({scrollDepth:maxScroll,readingTimeMs:Date.now()-startTime},extra||{}),t:Date.now()};try{if(type==="leave"){navigator.sendBeacon(url,JSON.stringify(d))}else{fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d),keepalive:true})}}catch(e){}}function onScroll(){var h=docH();if(h>0){var pct=Math.min(Math.round(window.scrollY/h*100),100);if(pct>maxScroll)maxScroll=pct}}window.addEventListener("scroll",onScroll,{passive:true});onScroll();send("pageview");var hbTimer=setInterval(function(){if(document.visibilityState==="visible"){send("heartbeat")}},30000);document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"){send("leave");clearInterval(hbTimer)}})})();`,
					key: "pensieve-engage-tracker",
				};
			},
		},

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
					const subscriberId = subscriber.id ?? hashEmail(subscriber.email);
					const unsubscribeUrl = `https://huuloc.com/_emdash/api/plugins/pensieve-engage/unsubscribe?email=${subscriber.email}`;

					// Wrap URLs in the text body with click-tracking redirects
					const urlRegex = /https?:\/\/[^\s<>"')\]]+/g;
					const trackedText = [
						`New memory: ${content.title}`,
						"",
						excerpt,
						"",
						`Read more: ${postUrl}`,
						"",
						"---",
						`Unsubscribe: ${unsubscribeUrl}`,
					]
						.join("\n")
						.replace(urlRegex, (originalUrl: string) => {
							return `https://huuloc.com/_emdash/api/plugins/pensieve-engage/click?s=${sendId}&sub=${subscriberId}&url=${encodeURIComponent(originalUrl)}`;
						});

					// Build HTML body with tracking pixel
					const trackedHtml = [
						`<h2>New memory: ${content.title}</h2>`,
						`<p>${excerpt}</p>`,
						`<p><a href="https://huuloc.com/_emdash/api/plugins/pensieve-engage/click?s=${sendId}&sub=${subscriberId}&url=${encodeURIComponent(postUrl)}">Read more</a></p>`,
						`<hr>`,
						`<p><a href="https://huuloc.com/_emdash/api/plugins/pensieve-engage/click?s=${sendId}&sub=${subscriberId}&url=${encodeURIComponent(unsubscribeUrl)}">Unsubscribe</a></p>`,
						`<img src="https://huuloc.com/_emdash/api/plugins/pensieve-engage/pixel?s=${sendId}&sub=${subscriberId}" width="1" height="1" alt="" style="display:none" />`,
					].join("\n");

					try {
						await ctx.email.send(
							{
								to: subscriber.email,
								subject: `[Pensieve] New memory: ${content.title}`,
								text: trackedText,
								html: trackedHtml,
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

		click: {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const url = new URL(routeCtx.request.url);
				const sendId = url.searchParams.get("s");
				const subscriberId = url.searchParams.get("sub");
				const targetUrl = url.searchParams.get("url");

				if (!targetUrl) {
					return new Response("Missing url parameter", { status: 400 });
				}

				const userAgent = routeCtx.request.headers.get("user-agent") ?? "";
				const clickedAt = new Date().toISOString();

				if (sendId) {
					await ctx.kv.set(`clicks:${sendId}:${Date.now()}`, {
						subscriberId,
						url: targetUrl,
						userAgent,
						clickedAt,
					});
				}

				return new Response(null, {
					status: 302,
					headers: { Location: decodeURIComponent(targetUrl) },
				});
			},
		},

		pixel: {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const url = new URL(routeCtx.request.url);
				const sendId = url.searchParams.get("s");
				const subscriberId = url.searchParams.get("sub");

				const userAgent = routeCtx.request.headers.get("user-agent") ?? "";
				const openedAt = new Date().toISOString();

				if (sendId && subscriberId) {
					await ctx.kv.set(`opens:${sendId}:${subscriberId}`, {
						openedAt,
						userAgent,
					});
				}

				const gif = new Uint8Array([
					0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
					0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
					0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
					0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
					0x01, 0x00, 0x3b,
				]);

				return new Response(gif, {
					headers: {
						"Content-Type": "image/gif",
						"Cache-Control": "no-store, no-cache, must-revalidate",
					},
				});
			},
		},

		beacon: {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				let body: any;
				try {
					body = await routeCtx.request.json();
				} catch {
					return new Response("Invalid JSON", { status: 400 });
				}

				const { postSlug, sessionId, eventType, data, t } = body;

				if (!postSlug || !sessionId || !eventType) {
					return new Response("Missing required fields", { status: 400 });
				}

				const id = `${sessionId}_${eventType}_${t || Date.now()}`;
				await ctx.storage.reading_events.put(id, {
					id,
					postSlug,
					sessionId,
					eventType,
					data: data || {},
					createdAt: new Date().toISOString(),
				});

				return new Response(null, { status: 204 });
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
