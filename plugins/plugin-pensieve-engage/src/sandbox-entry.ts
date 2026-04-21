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

// ctx.storage.*.query() returns rows shaped {id, data:{...fields}}. This
// helper flattens so downstream code can treat each item as a plain document.
function flattenRows(rows: any[]): any[] {
	return rows.map((r: any) => (r?.data ? { id: r.id, ...r.data } : r));
}

/** "Apr 20, 2026 23:33 · 12h ago" — exact local time + compact relative. */
function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return "—";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";

	const exact = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(d);

	const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
	let rel: string;
	if (sec < 60) rel = "just now";
	else if (sec < 3600) rel = `${Math.floor(sec / 60)}m ago`;
	else if (sec < 86400) rel = `${Math.floor(sec / 3600)}h ago`;
	else if (sec < 604800) rel = `${Math.floor(sec / 86400)}d ago`;
	else if (sec < 2592000) rel = `${Math.floor(sec / 604800)}w ago`;
	else if (sec < 31536000) rel = `${Math.floor(sec / 2592000)}mo ago`;
	else rel = `${Math.floor(sec / 31536000)}y ago`;

	return `${exact} · ${rel}`;
}

async function buildSubscribersPage(ctx: PluginContext) {
	const allSubscribers = await ctx.storage.subscribers.query({});
	const items = flattenRows(allSubscribers.items ?? allSubscribers ?? []);

	const total = items.length;
	const active = items.filter((s: any) => s.status === "active").length;
	const unsubscribed = items.filter((s: any) => s.status === "unsubscribed").length;

	// Block Kit's table expects columns:[{key,label,...}] and rows as
	// dictionaries keyed by column.key (not {cells:[...]}). See
	// @emdash-cms/blocks dist/index.js where `row[col.key]` is read.
	const rows = items.map((s: any) => ({
		email: s.email,
		status: s.status,
		subscribed: formatDateTime(s.createdAt),
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
				columns: [
					{ key: "email", label: "Email" },
					{ key: "status", label: "Status", format: "badge" },
					{ key: "subscribed", label: "Subscribed" },
				],
				rows,
				empty_text: "No subscribers yet.",
			},
		],
	};
}

async function buildSubscriberStatsWidget(ctx: PluginContext) {
	const allSubscribers = await ctx.storage.subscribers.query({});
	const items = flattenRows(allSubscribers.items ?? allSubscribers ?? []);

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
	const items = flattenRows(allSends.items ?? allSends ?? []) as any[];

	items.sort((a: any, b: any) => {
		const aTime = a.sentAt || a.completedAt || a.startedAt || "";
		const bTime = b.sentAt || b.completedAt || b.startedAt || "";
		return bTime.localeCompare(aTime);
	});

	const totalSends = items.length;
	const totalDelivered = items.reduce((sum: number, s: any) => sum + (s.sent || 0), 0);

	const rows = items.map((s: any) => ({
		post: s.slug || s.postSlug || "—",
		subscribers: s.subscriberCount ?? 0,
		status: s.status || "—",
		sent_at: formatDateTime(s.completedAt || s.startedAt),
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
				columns: [
					{ key: "post", label: "Post" },
					{ key: "subscribers", label: "Subscribers", format: "number" },
					{ key: "status", label: "Status", format: "badge" },
					{ key: "sent_at", label: "Sent At" },
				],
				rows,
				empty_text: "No sends yet.",
			},
		],
	};
}

async function buildAnalyticsPage(ctx: PluginContext) {
	const allEvents = await ctx.storage.reading_events.query({});
	const items = flattenRows(allEvents.items ?? allEvents ?? []) as any[];

	const totalPageviews = items.filter((e: any) => e.eventType === "pageview").length;
	const uniqueSessions = new Set(items.map((e: any) => e.sessionId)).size;

	// Email funnel: opens and clicks mirrored into reading_events by the
	// pixel/click handlers. Compute aggregate + per-send rates.
	const emailOpens = items.filter((e: any) => e.eventType === "email_open").length;
	const emailClicks = items.filter((e: any) => e.eventType === "email_click").length;

	// Lumos (likes) data
	const allLumos = await ctx.storage.lumos!.query({});
	const lumosItems = flattenRows(allLumos.items ?? allLumos ?? []) as any[];
	const totalLumos = lumosItems.length;

	const lumosByPost = new Map<string, number>();
	for (const like of lumosItems) {
		const slug = like.postSlug || "unknown";
		lumosByPost.set(slug, (lumosByPost.get(slug) || 0) + 1);
	}

	// Aggregate reading events by postSlug (now also split by source).
	interface PostAgg {
		pageviews: number;
		scrollDepths: number[];
		readingTimes: number[];
		bySource: Record<string, number>;
	}
	const byPost = new Map<string, PostAgg>();

	for (const event of items) {
		if (event.eventType !== "pageview" && event.eventType !== "leave") continue;
		const slug = event.postSlug || "unknown";
		if (!byPost.has(slug)) {
			byPost.set(slug, { pageviews: 0, scrollDepths: [], readingTimes: [], bySource: {} });
		}
		const agg = byPost.get(slug)!;

		if (event.eventType === "pageview") {
			agg.pageviews++;
			const src = (event.data?.source ?? "direct") as string;
			agg.bySource[src] = (agg.bySource[src] ?? 0) + 1;
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

	const formatSources = (bySource: Record<string, number>): string => {
		const entries = Object.entries(bySource).sort((a, b) => b[1] - a[1]);
		if (entries.length === 0) return "—";
		return entries.map(([src, n]) => `${src} ${n}`).join(" · ");
	};

	const allSlugs = new Set([...byPost.keys(), ...lumosByPost.keys()]);

	const rows = Array.from(allSlugs)
		.map((slug) => {
			const agg = byPost.get(slug) || { pageviews: 0, scrollDepths: [], readingTimes: [], bySource: {} };
			const lumos = lumosByPost.get(slug) || 0;
			const avgScroll = agg.scrollDepths.length > 0
				? Math.round(agg.scrollDepths.reduce((a, b) => a + b, 0) / agg.scrollDepths.length)
				: 0;
			const avgReadingMs = agg.readingTimes.length > 0
				? Math.round(agg.readingTimes.reduce((a, b) => a + b, 0) / agg.readingTimes.length)
				: 0;
			const avgReadingSec = Math.round(avgReadingMs / 1000);

			return {
				post: slug,
				pageviews: agg.pageviews,
				sources: formatSources(agg.bySource),
				scroll: `${avgScroll}%`,
				read_time: `${avgReadingSec}s`,
				lumos,
			};
		})
		.sort((a, b) => b.pageviews - a.pageviews);

	// Top-level source totals across the whole site (for the summary fields).
	const siteSources: Record<string, number> = {};
	for (const event of items) {
		if (event.eventType !== "pageview") continue;
		const src = (event.data?.source ?? "direct") as string;
		siteSources[src] = (siteSources[src] ?? 0) + 1;
	}

	const clickRate = emailOpens > 0 ? Math.round((emailClicks / emailOpens) * 100) : 0;

	return {
		blocks: [
			{ type: "header", text: "Reading Analytics" },
			{
				type: "fields",
				fields: [
					{ label: "Total Pageviews", value: String(totalPageviews) },
					{ label: "Unique Sessions", value: String(uniqueSessions) },
					{ label: "Total Lumos", value: String(totalLumos) },
					{ label: "Traffic Sources", value: formatSources(siteSources) },
				],
			},
			{ type: "header", text: "Owl Post Funnel" },
			{
				type: "fields",
				fields: [
					{ label: "Email Opens", value: String(emailOpens) },
					{ label: "Email Clicks", value: String(emailClicks) },
					{ label: "Click Rate", value: `${clickRate}%` },
				],
			},
			{ type: "divider" },
			{
				type: "table",
				columns: [
					{ key: "post", label: "Post" },
					{ key: "pageviews", label: "Pageviews", format: "number" },
					{ key: "sources", label: "Sources" },
					{ key: "scroll", label: "Avg Scroll" },
					{ key: "read_time", label: "Avg Read Time" },
					{ key: "lumos", label: "Lumos", format: "number" },
				],
				rows,
				empty_text: "No reading events yet.",
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

				// The inline tracker resolves a `source` attribution for the
				// pageview. Priority:
				//   1. ?src=<letter|fb|...> in the URL (set by /click for email
				//      links, and by Loc's own UTM-style links on FB posts).
				//   2. document.referrer matching FB domains.
				//   3. "direct" fallback.
				// Also captures ?sid=<sendId> so we can attribute reads back
				// to a specific newsletter send.
				return {
					kind: "inline-script",
					placement: "body:end",
					code: `(function(){var sid=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);var slug=${JSON.stringify(postSlug)};var url=${JSON.stringify(beaconUrl)};var startTime=Date.now();var maxScroll=0;var qs=new URLSearchParams(location.search);var src=(qs.get("src")||"").toLowerCase();var ref=document.referrer||"";if(!src){if(/(^|\\.)(facebook|fb)\\.com|(^|\\.)fb\\.me|(^|\\.)l\\.facebook\\.com|(^|\\.)m\\.facebook\\.com/.test(ref))src="fb";else if(ref&&!ref.startsWith(location.origin))src="referral";else src="direct";}var sendId=qs.get("sid")||null;var docH=function(){return Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)-window.innerHeight};function send(type,extra){var d={postSlug:slug,sessionId:sid,eventType:type,data:Object.assign({scrollDepth:maxScroll,readingTimeMs:Date.now()-startTime,source:src,sendId:sendId,referrer:ref||null},extra||{}),t:Date.now()};try{if(type==="leave"){navigator.sendBeacon(url,JSON.stringify(d))}else{fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d),keepalive:true})}}catch(e){}}function onScroll(){var h=docH();if(h>0){var pct=Math.min(Math.round(window.scrollY/h*100),100);if(pct>maxScroll)maxScroll=pct}}window.addEventListener("scroll",onScroll,{passive:true});onScroll();send("pageview");var hbTimer=setInterval(function(){if(document.visibilityState==="visible"){send("heartbeat")}},30000);document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"){send("leave");clearInterval(hbTimer)}})})();`,
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
					// exist yet for a never-written collection. Note: query() returns
					// rows shaped {id, data:{...fields}}, not flat — we must reach
					// into .data to see the email/status fields.
					const all = await ctx.storage.subscribers.query({});
					const items = all.items ?? all ?? [];
					const existing = items.find((s: any) => s.data?.email === email);

					if (existing) {
						const existingData = existing.data;
						if (existingData.status === "active") {
							return { success: true, message: "Already subscribed" };
						}
						await ctx.storage.subscribers.put(existing.id, {
							...existingData,
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
							const unsubscribeUrl = `https://huuloc.com/_emdash/api/plugins/pensieve-engage/unsubscribe?email=${encodeURIComponent(email)}`;
							const bodyWithFooter = `${welcomeBody}\n\n—\nUnsubscribe: ${unsubscribeUrl}`;
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
									text: bodyWithFooter,
									headers: {
										// Enables Gmail/Apple Mail's native "Unsubscribe" button and
										// RFC 8058 one-click POST unsubscribe (required for bulk
										// senders, good hygiene for small ones).
										"List-Unsubscribe": `<${unsubscribeUrl}>`,
										"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
									},
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
				try {
					const url = new URL(routeCtx.request.url);
					const email = url.searchParams.get("email")?.trim().toLowerCase();

					if (!email) {
						return new Response(
							"<html><body><h1>Missing email parameter</h1></body></html>",
							{ status: 400, headers: { "Content-Type": "text/html" } },
						);
					}

					// Same shape note as subscribe: query() returns {id, data:{...}}.
					const all = await ctx.storage.subscribers.query({});
					const items = all.items ?? all ?? [];
					const existing = items.find((s: any) => s.data?.email === email);

					if (existing) {
						await ctx.storage.subscribers.put(existing.id, {
							...existing.data,
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
				} catch (err) {
					ctx.log.info(
						`Unsubscribe handler failed: ${err instanceof Error ? err.message : String(err)}`,
					);
					return new Response(
						"<html><body><h1>Unsubscribe failed, please try again.</h1></body></html>",
						{ status: 500, headers: { "Content-Type": "text/html" } },
					);
				}
			},
		},

		click: {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const url = new URL(routeCtx.request.url);
				const sendId = url.searchParams.get("s");
				const subscriberId = url.searchParams.get("sub");
				const targetUrlRaw = url.searchParams.get("url");

				if (!targetUrlRaw) {
					return new Response("Missing url parameter", { status: 400 });
				}

				const userAgent = routeCtx.request.headers.get("user-agent") ?? "";
				const clickedAt = new Date().toISOString();

				// Mirror into storage (queryable by analytics) alongside the
				// existing KV write (kept for backward compat).
				if (sendId) {
					const eventId = `click_${sendId}_${Date.now()}`;
					try {
						await ctx.storage.reading_events.put(eventId, {
							id: eventId,
							eventType: "email_click",
							sessionId: subscriberId ?? "anonymous",
							postSlug: "",
							data: {
								sendId,
								subscriberId,
								url: targetUrlRaw,
								userAgent,
							},
							createdAt: clickedAt,
						});
					} catch {
						// non-fatal
					}
					await ctx.kv.set(`clicks:${sendId}:${Date.now()}`, {
						subscriberId,
						url: targetUrlRaw,
						userAgent,
						clickedAt,
					});
				}

				// Tag the redirect target so the post's inline tracker can
				// resolve source=letter + sendId from its own URL.
				let location: string;
				try {
					const decoded = decodeURIComponent(targetUrlRaw);
					const target = new URL(decoded);
					if (sendId) {
						target.searchParams.set("src", "letter");
						target.searchParams.set("sid", sendId);
					}
					location = target.toString();
				} catch {
					// Fallback — target wasn't a full URL, or was malformed.
					location = decodeURIComponent(targetUrlRaw);
				}

				return new Response(null, {
					status: 302,
					headers: { Location: location },
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
					// Mirror into storage for analytics (plus KV for legacy).
					const eventId = `open_${sendId}_${subscriberId}`;
					try {
						await ctx.storage.reading_events.put(eventId, {
							id: eventId,
							eventType: "email_open",
							sessionId: subscriberId,
							postSlug: "",
							data: { sendId, subscriberId, userAgent },
							createdAt: openedAt,
						});
					} catch {
						// non-fatal
					}
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
