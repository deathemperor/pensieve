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

async function buildSubscriberStatsWidget(ctx: PluginContext) {
	const allSubscribers = await ctx.storage.subscribers.query({});
	const items = allSubscribers.items ?? allSubscribers ?? [];

	const total = items.length;
	const active = items.filter((s: any) => s.status === "active").length;
	const unsubscribed = items.filter((s: any) => s.status === "unsubscribed").length;

	return {
		blocks: [
			{
				type: "fields",
				fields: [
					{ label: "Total", value: String(total) },
					{ label: "Active", value: String(active) },
					{ label: "Unsubscribed", value: String(unsubscribed) },
				],
			},
		],
	};
}

async function buildSendsPage(ctx: PluginContext) {
	const allSends = await ctx.storage.email_sends.query({});
	const items = (allSends.items ?? allSends ?? []) as any[];

	items.sort((a: any, b: any) => {
		const aTime = a.sentAt || a.completedAt || a.startedAt || "";
		const bTime = b.sentAt || b.completedAt || b.startedAt || "";
		return bTime.localeCompare(aTime);
	});

	const totalSends = items.length;
	const totalDelivered = items.reduce((sum: number, s: any) => sum + (s.sent || 0), 0);

	const rows = items.map((s: any) => ({
		cells: [
			s.slug || s.postSlug || "—",
			String(s.subscriberCount ?? 0),
			s.status || "—",
			s.completedAt || s.startedAt || "—",
		],
	}));

	return {
		blocks: [
			{ type: "header", text: "Email Sends" },
			{
				type: "fields",
				fields: [
					{ label: "Total Sends", value: String(totalSends) },
					{ label: "Total Delivered", value: String(totalDelivered) },
				],
			},
			{ type: "divider" },
			{
				type: "table",
				columns: ["Post", "Subscribers", "Status", "Sent At"],
				rows,
			},
		],
	};
}

async function buildAnalyticsPage(ctx: PluginContext) {
	const allEvents = await ctx.storage.reading_events.query({});
	const items = (allEvents.items ?? allEvents ?? []) as any[];

	const totalPageviews = items.filter((e: any) => e.eventType === "pageview").length;
	const uniqueSessions = new Set(items.map((e: any) => e.sessionId)).size;

	// Lumos (likes) data
	const allLumos = await ctx.storage.lumos!.query({});
	const lumosItems = (allLumos.items ?? allLumos ?? []) as any[];
	const totalLumos = lumosItems.length;

	// Lumos by post
	const lumosByPost = new Map<string, number>();
	for (const like of lumosItems) {
		const slug = like.data?.postSlug || like.postSlug || "unknown";
		lumosByPost.set(slug, (lumosByPost.get(slug) || 0) + 1);
	}

	// Aggregate reading events by postSlug
	const byPost = new Map<string, { pageviews: number; scrollDepths: number[]; readingTimes: number[] }>();

	for (const event of items) {
		const slug = event.postSlug || (event.data?.postSlug) || "unknown";
		if (!byPost.has(slug)) {
			byPost.set(slug, { pageviews: 0, scrollDepths: [], readingTimes: [] });
		}
		const agg = byPost.get(slug)!;

		if (event.eventType === "pageview") {
			agg.pageviews++;
		}

		if (event.eventType === "leave" && event.data) {
			if (typeof event.data.scrollDepth === "number") {
				agg.scrollDepths.push(event.data.scrollDepth);
			}
			if (typeof event.data.readingTimeMs === "number") {
				agg.readingTimes.push(event.data.readingTimeMs);
			}
		}
	}

	// Merge all known post slugs
	const allSlugs = new Set([...byPost.keys(), ...lumosByPost.keys()]);

	const rows = Array.from(allSlugs)
		.map((slug) => {
			const agg = byPost.get(slug) || { pageviews: 0, scrollDepths: [], readingTimes: [] };
			const lumos = lumosByPost.get(slug) || 0;
			const avgScroll = agg.scrollDepths.length > 0
				? Math.round(agg.scrollDepths.reduce((a, b) => a + b, 0) / agg.scrollDepths.length)
				: 0;
			const avgReadingMs = agg.readingTimes.length > 0
				? Math.round(agg.readingTimes.reduce((a, b) => a + b, 0) / agg.readingTimes.length)
				: 0;
			const avgReadingSec = Math.round(avgReadingMs / 1000);

			return {
				slug,
				pageviews: agg.pageviews,
				cells: [
					slug,
					String(agg.pageviews),
					`${avgScroll}%`,
					`${avgReadingSec}s`,
					String(lumos),
				],
			};
		})
		.sort((a, b) => b.pageviews - a.pageviews);

	return {
		blocks: [
			{ type: "header", text: "Reading Analytics" },
			{
				type: "fields",
				fields: [
					{ label: "Total Pageviews", value: String(totalPageviews) },
					{ label: "Unique Sessions", value: String(uniqueSessions) },
					{ label: "Total Lumos", value: String(totalLumos) },
				],
			},
			{ type: "divider" },
			{
				type: "table",
				columns: ["Post", "Pageviews", "Avg Scroll", "Avg Read Time", "Lumos"],
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
				await ctx.kv.set("settings:welcomeSubject", "Owl Post — welcome");
				await ctx.kv.set(
					"settings:welcomeBody",
					[
						"Hi friend,",
						"",
						"You've been added to the Pensieve owl route. Expect a letter whenever a new memory is pensieved — no schedule, no noise, and no dark magic.",
						"",
						"Bạn đã ghé vào Cú Bưu Điện. Cú sẽ tìm bạn khi có ký ức mới, không spam, không phép thuật đen.",
						"",
						"— Loc",
						"https://huuloc.com/pensieve",
					].join("\n"),
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
				try {
					// The runtime pre-parses the request body into routeCtx.input;
					// calling request.json() again would fail because the body stream
					// has already been consumed.
					const body = (routeCtx.input ?? {}) as { email?: string };
					const email = body.email?.trim().toLowerCase();

					if (!email || !isValidEmail(email)) {
						return { error: "Invalid email address" };
					}

					// Full scan + filter avoids depending on indexes that may not
					// exist yet for a never-written collection.
					const all = await ctx.storage.subscribers.query({});
					const items = all.items ?? all ?? [];
					const existing = items.find((s: any) => s.email === email);

					if (existing) {
						if (existing.status === "active") {
							return { success: true, message: "Already subscribed" };
						}
						await ctx.storage.subscribers.put(existing.id ?? hashEmail(email), {
							...existing,
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
						"Owl Post — welcome";
					const welcomeBody =
						(await ctx.kv.get<string>("settings:welcomeBody")) ??
						[
							"Hi friend,",
							"",
							"You've been added to the Pensieve owl route. Expect a letter whenever a new memory is pensieved — no schedule, no noise, and no dark magic.",
							"",
							"Bạn đã ghé vào Cú Bưu Điện. Cú sẽ tìm bạn khi có ký ức mới, không spam, không phép thuật đen.",
							"",
							"— Loc",
							"https://huuloc.com/pensieve",
						].join("\n");

					// Send welcome email via Resend directly. We can't use ctx.email.send
					// from a route handler because EmDash's runtime builds the route
					// context with only {db}, so the email pipeline is never wired up.
					// See middleware.mjs: `new PluginRouteRegistry({ db: this.db })`.
					try {
						const resendApiKey = await ctx.kv.get<string>("settings:resendApiKey");
						const fromEmail =
							(await ctx.kv.get<string>("settings:fromEmail")) ??
							"Pensieve <noreply@huuloc.com>";
						if (!resendApiKey) {
							ctx.log.info(`Welcome email skipped for ${email}: no resendApiKey in engage KV`);
						} else if (!ctx.http) {
							ctx.log.info(`Welcome email skipped for ${email}: ctx.http missing (network:fetch capability?)`);
						} else {
							const res = await ctx.http.fetch("https://api.resend.com/emails", {
								method: "POST",
								headers: {
									Authorization: `Bearer ${resendApiKey}`,
									"Content-Type": "application/json",
								},
								body: JSON.stringify({
									from: fromEmail,
									to: email,
									subject: welcomeSubject,
									text: welcomeBody,
								}),
							});
							if (!res.ok) {
								const body = await res.text();
								ctx.log.info(
									`Welcome email Resend error ${res.status} for ${email}: ${body.slice(0, 200)}`,
								);
							}
						}
					} catch (err) {
						const errMsg = err instanceof Error ? err.message : String(err);
						ctx.log.info(`Welcome email failed for ${email}: ${errMsg}`);
					}

					ctx.log.info(`New subscriber: ${email}`);
					return { success: true };
				} catch (err) {
					ctx.log.info(
						`Subscribe handler failed: ${err instanceof Error ? err.message : String(err)}`,
					);
					return { error: "Subscription failed, please try again" };
				}
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

				// Widget handlers
				if (interaction.type === "page_load" && interaction.page === "widget:subscriber-stats") {
					return buildSubscriberStatsWidget(ctx);
				}

				// Page handlers
				if (interaction.type === "page_load" && interaction.page === "/subscribers") {
					return buildSubscribersPage(ctx);
				}

				if (interaction.type === "page_load" && interaction.page === "/sends") {
					return buildSendsPage(ctx);
				}

				if (interaction.type === "page_load" && interaction.page === "/analytics") {
					return buildAnalyticsPage(ctx);
				}

				// Action handlers
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

		// Lumos — guest like button
		"lumos/cast": {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const { postSlug } = routeCtx.input as { postSlug?: string };
				if (!postSlug) return { error: "Missing postSlug" };

				// IP hash for spam prevention
				const ip = routeCtx.request.headers.get("cf-connecting-ip") || routeCtx.request.headers.get("x-forwarded-for") || "unknown";
				let ipHash = 0;
				for (let i = 0; i < ip.length; i++) {
					ipHash = ((ipHash << 5) - ipHash + ip.charCodeAt(i)) | 0;
				}
				const ipKey = `ip_${Math.abs(ipHash).toString(36)}`;

				// Check if already liked by this IP
				const existing = await ctx.storage.lumos!.query({
					where: { postSlug, ipHash: ipKey },
					limit: 1,
				});

				if (existing.items.length > 0) {
					// Already liked — return current count
					const total = await ctx.storage.lumos!.count({ postSlug });
					return { success: false, alreadyCast: true, count: total };
				}

				// Cast Lumos
				const id = `lumos_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
				await ctx.storage.lumos!.put(id, {
					postSlug,
					ipHash: ipKey,
					castAt: new Date().toISOString(),
				});

				const total = await ctx.storage.lumos!.count({ postSlug });
				return { success: true, count: total };
			},
		},

		"lumos/count": {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const url = new URL(routeCtx.request.url);
				const postSlug = url.searchParams.get("post");
				if (!postSlug) return { count: 0 };

				const total = await ctx.storage.lumos!.count({ postSlug });
				return { count: total };
			},
		},
	},
});
