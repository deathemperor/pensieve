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

// Stable 32-bit FNV-1a hash for IP → pseudonymous visitor bucketing without PII.
function fnv1a(str: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return h.toString(36);
}

// Minimal UA classifier — device/browser/OS family buckets + bot flag. Good
// enough for aggregate analytics; avoids pulling a 200KB dep into the sandbox.
function parseUA(ua: string): { device: string; browser: string; os: string; isBot: boolean } {
	const s = ua.toLowerCase();
	const isBot = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|phantomjs|lighthouse|pagespeed/.test(s);
	const device = /mobile|android|iphone|ipod/.test(s) && !/ipad|tablet/.test(s)
		? "mobile"
		: /ipad|tablet/.test(s) ? "tablet" : "desktop";
	const browser = /edg\//.test(s) ? "Edge"
		: /chrome\//.test(s) && !/chromium/.test(s) ? "Chrome"
		: /firefox\//.test(s) ? "Firefox"
		: /safari\//.test(s) && !/chrome/.test(s) ? "Safari"
		: /opera|opr\//.test(s) ? "Opera"
		: "Other";
	const os = /windows/.test(s) ? "Windows"
		: /mac os x|macintosh/.test(s) ? "macOS"
		: /android/.test(s) ? "Android"
		: /iphone|ipad|ipod/.test(s) ? "iOS"
		: /linux/.test(s) ? "Linux"
		: "Other";
	return { device, browser, os, isBot };
}

// Classify a pathname into a coarse section so the dashboard can group
// traffic without enumerating every slug. Also derives `postSlug` for
// post-scoped queries (keeps backward compat with existing analytics).
function classifyPath(path: string): { section: string; postSlug: string | null } {
	const m = path.match(/^\/(en\/)?pensieve\/memories\/([^\/?#]+)/);
	if (m) return { section: "post", postSlug: m[2] };
	if (/^\/(en\/)?pensieve\/?$/.test(path)) return { section: "pensieve-home", postSlug: null };
	if (/^\/(en\/)?pensieve\/category\//.test(path)) return { section: "category", postSlug: null };
	if (/^\/(en\/)?pensieve\/tag\//.test(path)) return { section: "tag", postSlug: null };
	if (/^\/(en\/)?pensieve\/search/.test(path)) return { section: "search", postSlug: null };
	if (/^\/(en\/)?pensieve\/about/.test(path)) return { section: "about", postSlug: null };
	if (/^\/(en\/)?room-of-requirement/.test(path)) return { section: "room-of-requirement", postSlug: null };
	if (/^\/(en\/)?tr[ư|u]ong/i.test(path)) return { section: "truong", postSlug: null };
	if (/^\/(en\/)?hogwarts\//.test(path)) return { section: "hogwarts", postSlug: null };
	if (/^\/(en\/)?games?\//.test(path)) return { section: "game", postSlug: null };
	if (/^\/_emdash/.test(path)) return { section: "admin", postSlug: null };
	if (/^\/$|^\/en\/?$/.test(path)) return { section: "root", postSlug: null };
	return { section: "other", postSlug: null };
}

function percent(num: number, den: number): string {
	if (den <= 0) return "0%";
	return Math.round((num / den) * 100) + "%";
}

function formatDuration(ms: number): string {
	if (ms < 1000) return ms + "ms";
	const s = Math.round(ms / 1000);
	if (s < 60) return s + "s";
	const m = Math.floor(s / 60);
	const rs = s % 60;
	return m + "m " + rs + "s";
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

// ———————————————————————————————————————————————————————
// Site-wide analytics helpers (beyond the per-post view)
// ———————————————————————————————————————————————————————

interface EventRow {
	id: string;
	path: string;
	postSlug: string | null;
	section: string;
	sessionId: string;
	visitorId: string;
	pageviewId: string;
	eventType: string;
	country: string;
	device: string;
	browser: string;
	os: string;
	referrer: string;
	refHost: string;
	utmSource: string;
	data: Record<string, unknown>;
	createdAt: string;
	createdAtMs: number;
}

async function loadEvents(ctx: PluginContext, sinceMs?: number): Promise<EventRow[]> {
	const all = await ctx.storage.reading_events.query({});
	const items = flattenRows(all.items ?? all ?? []) as any[];
	const rows: EventRow[] = items.map((e: any) => ({
		id: e.id,
		path: e.path || (e.postSlug ? "/pensieve/memories/" + e.postSlug : ""),
		postSlug: e.postSlug || null,
		section: e.section || (e.postSlug ? "post" : "other"),
		sessionId: e.sessionId || "",
		visitorId: e.visitorId || e.sessionId || "",
		pageviewId: e.pageviewId || e.sessionId || "",
		eventType: e.eventType || "",
		country: e.country || "",
		device: e.device || "",
		browser: e.browser || "",
		os: e.os || "",
		referrer: e.referrer || "",
		refHost: e.refHost || "",
		utmSource: e.utmSource || "",
		data: e.data || {},
		createdAt: e.createdAt || "",
		createdAtMs: e.createdAt ? Date.parse(e.createdAt) : 0,
	}));
	const filtered = sinceMs ? rows.filter((r) => r.createdAtMs >= sinceMs) : rows;
	filtered.sort((a, b) => a.createdAtMs - b.createdAtMs);
	return filtered;
}

// Aggregate per-pageview across events. One pageview = all events sharing
// a `pageviewId`. This lets us compute "sessions that hit 50% scroll" etc.
interface PageviewAgg {
	path: string;
	section: string;
	postSlug: string | null;
	sessionId: string;
	visitorId: string;
	country: string;
	device: string;
	browser: string;
	refHost: string;
	utmSource: string;
	maxScroll: number;
	activeMs: number;
	dwellMs: number;
	firstSeen: number;
	milestones: Set<number>;
}

function aggregatePageviews(events: EventRow[]): Map<string, PageviewAgg> {
	const byPv = new Map<string, PageviewAgg>();
	for (const e of events) {
		// Only count reading-tracker events, not email_open/click mirrors.
		if (e.eventType === "email_open" || e.eventType === "email_click") continue;
		if (!e.pageviewId) continue;
		let pv = byPv.get(e.pageviewId);
		if (!pv) {
			pv = {
				path: e.path,
				section: e.section,
				postSlug: e.postSlug,
				sessionId: e.sessionId,
				visitorId: e.visitorId,
				country: e.country,
				device: e.device,
				browser: e.browser,
				refHost: e.refHost,
				utmSource: e.utmSource,
				maxScroll: 0,
				activeMs: 0,
				dwellMs: 0,
				firstSeen: e.createdAtMs,
				milestones: new Set(),
			};
			byPv.set(e.pageviewId, pv);
		}
		const d = e.data as any;
		if (typeof d.scrollDepth === "number") pv.maxScroll = Math.max(pv.maxScroll, d.scrollDepth);
		if (typeof d.activeMs === "number") pv.activeMs = Math.max(pv.activeMs, d.activeMs);
		if (typeof d.dwellMs === "number") pv.dwellMs = Math.max(pv.dwellMs, d.dwellMs);
		if (typeof d.depth === "number") pv.milestones.add(d.depth);
	}
	return byPv;
}

function topN<T>(map: Map<string, T>, n: number, toNum: (v: T) => number): Array<{ key: string; value: T }> {
	return Array.from(map.entries())
		.map(([key, value]) => ({ key, value }))
		.sort((a, b) => toNum(b.value) - toNum(a.value))
		.slice(0, n);
}

async function buildPagesPage(ctx: PluginContext) {
	const now = Date.now();
	const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
	const events = await loadEvents(ctx, thirtyDaysAgo);
	const pvs = Array.from(aggregatePageviews(events).values());

	type PathAgg = {
		pv: number;
		visitors: Set<string>;
		totalActive: number;
		totalScroll: number;
		scrollN: number;
		m100: number;
	};
	const pathAgg = new Map<string, PathAgg>();
	for (const p of pvs) {
		const key = p.path || "(unknown)";
		let a = pathAgg.get(key);
		if (!a) {
			a = { pv: 0, visitors: new Set(), totalActive: 0, totalScroll: 0, scrollN: 0, m100: 0 };
			pathAgg.set(key, a);
		}
		a.pv++;
		if (p.visitorId) a.visitors.add(p.visitorId);
		a.totalActive += p.activeMs;
		if (p.maxScroll > 0) { a.totalScroll += p.maxScroll; a.scrollN++; }
		if (p.milestones.has(100) || p.maxScroll >= 100) a.m100++;
	}

	const allLumos = await ctx.storage.lumos!.query({});
	const lumosItems = flattenRows(allLumos.items ?? allLumos ?? []) as any[];
	const lumosByPost = new Map<string, number>();
	for (const like of lumosItems) {
		const slug = like.postSlug || "unknown";
		lumosByPost.set(slug, (lumosByPost.get(slug) || 0) + 1);
	}

	const rows = Array.from(pathAgg.entries())
		.map(([path, a]) => {
			const slug = path.match(/\/memories\/([^\/?#]+)/)?.[1] || null;
			const lumos = slug ? lumosByPost.get(slug) || 0 : 0;
			return {
				path,
				pageviews: a.pv,
				visitors: a.visitors.size,
				avg_scroll: (a.scrollN > 0 ? Math.round(a.totalScroll / a.scrollN) : 0) + "%",
				avg_time: formatDuration(a.pv > 0 ? Math.round(a.totalActive / a.pv) : 0),
				read_100: a.pv > 0 ? percent(a.m100, a.pv) : "—",
				lumos,
			};
		})
		.sort((a, b) => b.pageviews - a.pageviews);

	return {
		blocks: [
			{ type: "header", text: "Pages — last 30 days" },
			{
				type: "table",
				columns: [
					{ key: "path", label: "Path" },
					{ key: "pageviews", label: "Views", format: "number" },
					{ key: "visitors", label: "Visitors", format: "number" },
					{ key: "avg_scroll", label: "Avg Scroll" },
					{ key: "avg_time", label: "Avg Active" },
					{ key: "read_100", label: "Read 100%" },
					{ key: "lumos", label: "Lumos", format: "number" },
				],
				rows,
				empty_text: "No page data yet.",
			},
		],
	};
}

async function buildReferrersPage(ctx: PluginContext) {
	const now = Date.now();
	const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
	const events = await loadEvents(ctx, thirtyDaysAgo);
	const pvs = Array.from(aggregatePageviews(events).values());

	const hostAgg = new Map<string, { pv: number; visitors: Set<string> }>();
	for (const p of pvs) {
		const h = p.refHost || "(direct)";
		let a = hostAgg.get(h);
		if (!a) { a = { pv: 0, visitors: new Set() }; hostAgg.set(h, a); }
		a.pv++;
		if (p.visitorId) a.visitors.add(p.visitorId);
	}

	const total = pvs.length;
	const hostRows = Array.from(hostAgg.entries())
		.map(([k, a]) => ({ source: k, pageviews: a.pv, visitors: a.visitors.size, share: percent(a.pv, total) }))
		.sort((a, b) => b.pageviews - a.pageviews);

	const utmAgg = new Map<string, number>();
	for (const p of pvs) {
		if (!p.utmSource) continue;
		utmAgg.set(p.utmSource, (utmAgg.get(p.utmSource) || 0) + 1);
	}
	const utmRows = Array.from(utmAgg.entries())
		.map(([k, v]) => ({ source: k, pageviews: v }))
		.sort((a, b) => b.pageviews - a.pageviews);

	return {
		blocks: [
			{ type: "header", text: "Referrers — last 30 days" },
			{
				type: "table",
				columns: [
					{ key: "source", label: "Referrer" },
					{ key: "pageviews", label: "Views", format: "number" },
					{ key: "visitors", label: "Visitors", format: "number" },
					{ key: "share", label: "Share" },
				],
				rows: hostRows,
				empty_text: "No referrer data yet.",
			},
			{ type: "divider" },
			{ type: "header", text: "UTM Sources" },
			{
				type: "table",
				columns: [
					{ key: "source", label: "utm_source" },
					{ key: "pageviews", label: "Views", format: "number" },
				],
				rows: utmRows,
				empty_text: "No UTM traffic yet.",
			},
		],
	};
}

async function buildAudiencePage(ctx: PluginContext) {
	const now = Date.now();
	const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
	const events = await loadEvents(ctx, thirtyDaysAgo);
	const pvs = Array.from(aggregatePageviews(events).values());

	function agg(selector: (p: PageviewAgg) => string): Array<{ bucket: string; pageviews: number; share: string }> {
		const m = new Map<string, number>();
		for (const p of pvs) {
			const k = selector(p) || "(unknown)";
			m.set(k, (m.get(k) || 0) + 1);
		}
		const total = pvs.length;
		return Array.from(m.entries())
			.map(([k, v]) => ({ bucket: k, pageviews: v, share: percent(v, total) }))
			.sort((a, b) => b.pageviews - a.pageviews);
	}

	return {
		blocks: [
			{ type: "header", text: "Audience — last 30 days" },
			{ type: "header", text: "Countries" },
			{
				type: "table",
				columns: [
					{ key: "bucket", label: "Country" },
					{ key: "pageviews", label: "Views", format: "number" },
					{ key: "share", label: "Share" },
				],
				rows: agg((p) => p.country),
				empty_text: "No country data yet.",
			},
			{ type: "divider" },
			{ type: "header", text: "Devices" },
			{
				type: "table",
				columns: [
					{ key: "bucket", label: "Device" },
					{ key: "pageviews", label: "Views", format: "number" },
					{ key: "share", label: "Share" },
				],
				rows: agg((p) => p.device),
				empty_text: "No device data yet.",
			},
			{ type: "divider" },
			{ type: "header", text: "Browsers" },
			{
				type: "table",
				columns: [
					{ key: "bucket", label: "Browser" },
					{ key: "pageviews", label: "Views", format: "number" },
					{ key: "share", label: "Share" },
				],
				rows: agg((p) => p.browser),
				empty_text: "No browser data yet.",
			},
		],
	};
}

async function buildLivePage(ctx: PluginContext) {
	const now = Date.now();
	const fifteenMinAgo = now - 15 * 60 * 1000;
	const events = await loadEvents(ctx, fifteenMinAgo);

	const fiveMinAgo = now - 5 * 60 * 1000;
	const activeVisitors = new Set(
		events.filter((e) => e.createdAtMs >= fiveMinAgo).map((e) => e.visitorId).filter(Boolean),
	);

	const recent = events.slice(-50).reverse().map((e) => ({
		when: formatDateTime(e.createdAt),
		type: e.eventType,
		path: e.path || "—",
		country: e.country || "—",
		device: e.device || "—",
		ref: e.refHost || "(direct)",
	}));

	return {
		blocks: [
			{ type: "header", text: "Live (last 15 min)" },
			{
				type: "fields",
				fields: [
					{ label: "Active Now (5m)", value: String(activeVisitors.size) },
					{ label: "Events (15m)", value: String(events.length) },
				],
			},
			{ type: "divider" },
			{
				type: "table",
				columns: [
					{ key: "when", label: "When" },
					{ key: "type", label: "Event", format: "badge" },
					{ key: "path", label: "Path" },
					{ key: "country", label: "Country" },
					{ key: "device", label: "Device" },
					{ key: "ref", label: "Referrer" },
				],
				rows: recent,
				empty_text: "No activity in the last 15 minutes.",
			},
		],
	};
}

async function buildTrafficWidget(ctx: PluginContext) {
	const now = Date.now();
	const dayAgo = now - 24 * 60 * 60 * 1000;
	const events = await loadEvents(ctx, dayAgo);
	const pvs = Array.from(aggregatePageviews(events).values());
	const visitors = new Set(pvs.map((p) => p.visitorId).filter(Boolean)).size;
	const sessions = new Set(pvs.map((p) => p.sessionId).filter(Boolean)).size;

	return {
		blocks: [
			{
				type: "fields",
				fields: [
					{ label: "Pageviews", value: String(pvs.length) },
					{ label: "Visitors", value: String(visitors) },
					{ label: "Sessions", value: String(sessions) },
				],
			},
		],
	};
}

async function buildTopPagesTodayWidget(ctx: PluginContext) {
	const now = Date.now();
	const dayAgo = now - 24 * 60 * 60 * 1000;
	const events = await loadEvents(ctx, dayAgo);
	const pvs = Array.from(aggregatePageviews(events).values());

	const agg = new Map<string, number>();
	for (const p of pvs) {
		const k = p.path || "(unknown)";
		agg.set(k, (agg.get(k) || 0) + 1);
	}
	const rows = topN(agg, 5, (v) => v).map(({ key, value }) => ({ path: key, pageviews: value }));

	return {
		blocks: [
			{
				type: "table",
				columns: [
					{ key: "path", label: "Path" },
					{ key: "pageviews", label: "Views", format: "number" },
				],
				rows,
				empty_text: "No traffic today.",
			},
		],
	};
}

export default definePlugin({
	hooks: {
		// Note: page:fragments was the intended place for the pageview beacon
		// tracker, but the hook never fires for this plugin on live pages
		// despite the page:inject capability being present and the plugin
		// being registered in the pipeline. After extended debugging the
		// tracker was moved inline to Base.astro — see site-reading-tracker
		// script. This file still owns the /beacon route that receives events.

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
				try {
					// Runtime pre-parses the body into routeCtx.input. Reading
					// routeCtx.request.json() here fails because the body stream
					// has already been consumed — unless the browser posted via
					// sendBeacon with a Blob, in which case `input` is empty and
					// we fall back to manual parsing.
					let body: any = routeCtx.input;
					if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
						try {
							body = await routeCtx.request.json();
						} catch {
							return { ok: false, error: "Invalid JSON" };
						}
					}

					const eventType = body.eventType || body.type;
					const sessionId = body.sessionId || body.s;

					if (!sessionId || !eventType) {
						return {
							ok: false,
							error: "Missing required fields",
							got: { sessionId: !!sessionId, eventType: !!eventType },
						};
					}

					// Derive path + section + postSlug. Site-wide events send
					// `path`; legacy post-only events send `postSlug`. Support
					// both and fill in what's missing from whichever we got.
					const path: string = body.path || (body.postSlug ? `/pensieve/memories/${body.postSlug}` : "");
					const { section, postSlug: derivedSlug } = classifyPath(path);
					const postSlug = body.postSlug || derivedSlug || "";

					// Server-side enrichment from Cloudflare headers + UA.
					const headers = routeCtx.request.headers;
					const ua = headers.get("user-agent") || "";
					const parsed = parseUA(ua);
					if (parsed.isBot) {
						return { ok: true, bot: true };
					}

					const ip =
						headers.get("cf-connecting-ip") ||
						headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
						"";
					const ipHash = ip ? fnv1a(ip) : "";
					const country = headers.get("cf-ipcountry") || "";

					// Parse referrer host (strip if same-origin).
					const data = (body.data || {}) as Record<string, any>;
					const ref: string = data.referrer || body.ref || "";
					let refHost = "";
					if (ref) {
						try {
							const u = new URL(ref);
							if (u.host !== headers.get("host")) refHost = u.host;
						} catch {}
					}

					const utm = (data.utm || {}) as Record<string, string>;
					const t = body.t || Date.now();
					const rid = Math.random().toString(36).slice(2, 10);
					const id = `${sessionId}_${eventType}_${t}_${rid}`;

					await ctx.storage.reading_events.put(id, {
						id,
						path,
						section,
						postSlug,
						sessionId,
						visitorId: body.visitorId || body.v || sessionId,
						pageviewId: body.pageviewId || body.pv || sessionId,
						eventType,
						ipHash,
						country,
						device: parsed.device,
						browser: parsed.browser,
						os: parsed.os,
						referrer: ref.slice(0, 500),
						refHost,
						utmSource: utm.utm_source || "",
						utmMedium: utm.utm_medium || "",
						utmCampaign: utm.utm_campaign || "",
						data,
						createdAt: new Date(t).toISOString(),
					});

					return { ok: true, id };
				} catch (err) {
					ctx.log.info(
						`beacon handler error: ${err instanceof Error ? err.message : String(err)}`,
					);
					return { ok: false, error: "beacon failed" };
				}
			},
		},

		admin: {
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const interaction = routeCtx.input;

				// Widget handlers
				if (interaction.type === "page_load" && interaction.page === "widget:subscriber-stats") {
					return buildSubscriberStatsWidget(ctx);
				}
				if (interaction.type === "page_load" && interaction.page === "widget:traffic-stats") {
					return buildTrafficWidget(ctx);
				}
				if (interaction.type === "page_load" && interaction.page === "widget:top-pages-today") {
					return buildTopPagesTodayWidget(ctx);
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

				if (interaction.type === "page_load" && interaction.page === "/analytics/pages") {
					return buildPagesPage(ctx);
				}
				if (interaction.type === "page_load" && interaction.page === "/analytics/referrers") {
					return buildReferrersPage(ctx);
				}
				if (interaction.type === "page_load" && interaction.page === "/analytics/audience") {
					return buildAudiencePage(ctx);
				}
				if (interaction.type === "page_load" && interaction.page === "/analytics/live") {
					return buildLivePage(ctx);
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
