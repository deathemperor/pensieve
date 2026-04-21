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

// Stable 32-bit hash for IP/UA → pseudonymous visitor bucketing without PII.
function fnv1a(str: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return h.toString(36);
}

// Minimal UA parser — device class + browser family + OS family. Good enough
// for aggregate buckets; avoids pulling a 200KB dep into the sandbox.
function parseUA(ua: string): { device: string; browser: string; os: string; isBot: boolean } {
	const s = ua.toLowerCase();
	const isBot = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|curl|wget|phantomjs|lighthouse|pagespeed/.test(s);
	const device = /mobile|android|iphone|ipod/.test(s) && !/ipad|tablet/.test(s)
		? "mobile"
		: /ipad|tablet/.test(s)
			? "tablet"
			: "desktop";
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
// traffic without enumerating every slug. Keep in sync with the site's
// route table in src/data/site-routes.json.
function classifyPath(path: string): { section: string; postSlug: string | null } {
	const m = path.match(/^\/(en\/)?pensieve\/memories\/([^\/?#]+)/);
	if (m) return { section: "post", postSlug: m[2] };
	if (/^\/(en\/)?pensieve\/?$/.test(path)) return { section: "pensieve-home", postSlug: null };
	if (/^\/(en\/)?pensieve\/category\//.test(path)) return { section: "category", postSlug: null };
	if (/^\/(en\/)?pensieve\/tag\//.test(path)) return { section: "tag", postSlug: null };
	if (/^\/(en\/)?pensieve\/search/.test(path)) return { section: "search", postSlug: null };
	if (/^\/(en\/)?pensieve\/about/.test(path)) return { section: "about", postSlug: null };
	if (/^\/(en\/)?room-of-requirement/.test(path)) return { section: "room-of-requirement", postSlug: null };
	if (/^\/(en\/)?truong/.test(path)) return { section: "truong", postSlug: null };
	if (/^\/(en\/)?games?\//.test(path)) return { section: "game", postSlug: null };
	if (/^\/_emdash/.test(path)) return { section: "admin", postSlug: null };
	if (/^\/$|^\/en\/?$/.test(path)) return { section: "root", postSlug: null };
	return { section: "other", postSlug: null };
}

// Public tracker script — served once per visitor (cached 1h), shared across
// all pages. Deliberately plain ES5 for maximum compatibility (no bundler
// available inside the sandbox, no way to emit modern output with fallbacks).
//
// Design notes:
// - sessionStorage-scoped session id, 30-min inactivity timeout
// - localStorage-scoped visitor id (stable across sessions, no PII)
// - Active read time: only accrues while tab visible AND user interacted
//   within the last 30s (industry-standard pattern; idle tab doesn't inflate)
// - Scroll milestones at 25/50/75/100 fire once each per pageview
// - Outbound clicks tracked via delegated listener
// - Leave event uses sendBeacon so it survives unload; heartbeat uses fetch
//   keepalive for mid-session samples
const TRACKER_JS = `(function(){
try {
	if (navigator.webdriver) return;
	var UA = navigator.userAgent || "";
	if (/bot|crawler|spider|headless|lighthouse/i.test(UA)) return;

	var BEACON = "/_emdash/api/plugins/pensieve-engage/beacon";
	var VKEY = "pe_v";
	var SKEY = "pe_s";
	var STOUT = 30*60*1000; // 30m session idle

	function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }
	function getVisitor(){
		try {
			var v = localStorage.getItem(VKEY);
			if (!v) { v = uid(); localStorage.setItem(VKEY, v); }
			return v;
		} catch(e) { return "anon_"+uid(); }
	}
	function getSession(){
		try {
			var raw = sessionStorage.getItem(SKEY);
			var now = Date.now();
			if (raw) {
				var parts = raw.split("|");
				var lastSeen = parseInt(parts[1]||"0", 10);
				if (now - lastSeen < STOUT) {
					sessionStorage.setItem(SKEY, parts[0]+"|"+now);
					return { id: parts[0], isNew: false };
				}
			}
			var sid = uid();
			sessionStorage.setItem(SKEY, sid+"|"+now);
			return { id: sid, isNew: true };
		} catch(e) { return { id: "anon_"+uid(), isNew: true }; }
	}
	function touchSession(){
		try {
			var raw = sessionStorage.getItem(SKEY);
			if (!raw) return;
			var sid = raw.split("|")[0];
			sessionStorage.setItem(SKEY, sid+"|"+Date.now());
		} catch(e) {}
	}

	var visitor = getVisitor();
	var ses = getSession();
	var pageviewId = uid();
	var startTime = Date.now();

	// Active reading time
	var activeMs = 0;
	var lastTick = Date.now();
	var lastInteract = Date.now();
	var visible = document.visibilityState === "visible";
	var INTERACT_WINDOW = 30000;

	function tickActive(){
		var now = Date.now();
		var delta = now - lastTick;
		lastTick = now;
		if (visible && (now - lastInteract) < INTERACT_WINDOW && delta < 60000) {
			activeMs += delta;
		}
	}

	// Scroll depth
	var maxScroll = 0;
	var milestones = { 25: false, 50: false, 75: false, 100: false };
	function docH(){ return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight; }
	function scrollPct(){
		var h = docH();
		if (h <= 0) return 100;
		return Math.min(Math.round(window.scrollY / h * 100), 100);
	}

	// UTM + referrer captured once per session-origin pageview
	function collectUtm(){
		var u = {};
		try {
			var q = new URLSearchParams(location.search);
			["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(function(k){
				var v = q.get(k);
				if (v) u[k] = v.slice(0, 100);
			});
		} catch(e){}
		return u;
	}

	function basePayload(){
		return {
			v: visitor,
			s: ses.id,
			pv: pageviewId,
			path: location.pathname,
			qs: location.search ? location.search.slice(0, 200) : "",
			ref: document.referrer || "",
			title: (document.title || "").slice(0, 200),
			vw: window.innerWidth,
			vh: window.innerHeight,
			dpr: window.devicePixelRatio || 1,
			lang: (navigator.language || "").slice(0, 10),
			tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
			t: Date.now()
		};
	}

	function send(type, extra, useBeacon){
		var p = basePayload();
		p.type = type;
		p.data = extra || {};
		try {
			var body = JSON.stringify(p);
			if (useBeacon && navigator.sendBeacon) {
				var blob = new Blob([body], { type: "application/json" });
				navigator.sendBeacon(BEACON, blob);
			} else {
				fetch(BEACON, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true });
			}
		} catch(e) {}
	}

	// Initial pageview
	var initData = { utm: collectUtm(), newSession: ses.isNew };
	send("pageview", initData);

	// Heartbeat: 15s while tab visible
	var hbTimer = setInterval(function(){
		tickActive();
		touchSession();
		if (visible) {
			send("heartbeat", { scrollMax: maxScroll, activeMs: activeMs });
		}
	}, 15000);

	// Scroll milestones
	var scrollRaf = null;
	function onScroll(){
		lastInteract = Date.now();
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(function(){
			scrollRaf = null;
			var pct = scrollPct();
			if (pct > maxScroll) maxScroll = pct;
			[25,50,75,100].forEach(function(ms){
				if (!milestones[ms] && maxScroll >= ms) {
					milestones[ms] = true;
					send("scroll", { depth: ms, activeMs: activeMs });
				}
			});
		});
	}
	window.addEventListener("scroll", onScroll, { passive: true });

	// Interaction signals feed the active-time gate
	["mousemove","keydown","touchstart","click"].forEach(function(ev){
		window.addEventListener(ev, function(){ lastInteract = Date.now(); }, { passive: true });
	});

	// Outbound link tracking
	document.addEventListener("click", function(e){
		var a = e.target;
		while (a && a.nodeName !== "A") a = a.parentNode;
		if (!a || !a.href) return;
		try {
			var url = new URL(a.href, location.href);
			if (url.host && url.host !== location.host) {
				send("outbound", { href: url.href.slice(0, 500), host: url.host }, false);
			}
		} catch(err){}
	}, true);

	// Visibility transitions
	document.addEventListener("visibilitychange", function(){
		tickActive();
		visible = document.visibilityState === "visible";
		if (!visible) {
			send("leave", { scrollMax: maxScroll, activeMs: activeMs, dwellMs: Date.now() - startTime }, true);
		} else {
			lastTick = Date.now();
			lastInteract = Date.now();
		}
	});

	// Final leave on pagehide (more reliable than beforeunload on mobile)
	window.addEventListener("pagehide", function(){
		tickActive();
		send("leave", { scrollMax: maxScroll, activeMs: activeMs, dwellMs: Date.now() - startTime }, true);
		clearInterval(hbTimer);
	});
} catch(e) {}
})();`;

async function buildSubscribersPage(ctx: PluginContext) {
	const allSubscribers = await ctx.storage.subscribers.query({});
	const items = flattenRows(allSubscribers.items ?? allSubscribers ?? []);

	const total = items.length;
	const active = items.filter((s: any) => s.status === "active").length;
	const unsubscribed = items.filter((s: any) => s.status === "unsubscribed").length;

	const rows = items.map((s: any) => ({
		email: s.email,
		status: s.status,
		subscribed: s.createdAt,
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
					{ key: "subscribed", label: "Subscribed", format: "relative_time" },
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
		sent_at: s.completedAt || s.startedAt || null,
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
					{ key: "sent_at", label: "Sent At", format: "relative_time" },
				],
				rows,
				empty_text: "No sends yet.",
			},
		],
	};
}

// ——————————————————————————————————————————————
// Analytics helpers
// ——————————————————————————————————————————————

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
	utmMedium: string;
	utmCampaign: string;
	data: Record<string, unknown>;
	createdAt: string;
	createdAtMs: number;
}

async function loadEvents(ctx: PluginContext, sinceMs?: number): Promise<EventRow[]> {
	const all = await ctx.storage.reading_events.query({});
	const items = flattenRows(all.items ?? all ?? []) as any[];
	const rows: EventRow[] = items.map((e: any) => ({
		id: e.id,
		path: e.path || (e.postSlug ? "/pensieve/memories/" + e.postSlug : "unknown"),
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
		utmMedium: e.utmMedium || "",
		utmCampaign: e.utmCampaign || "",
		data: e.data || {},
		createdAt: e.createdAt || "",
		createdAtMs: e.createdAt ? Date.parse(e.createdAt) : 0,
	}));
	const filtered = sinceMs ? rows.filter((r) => r.createdAtMs >= sinceMs) : rows;
	filtered.sort((a, b) => a.createdAtMs - b.createdAtMs);
	return filtered;
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

function topN<T>(map: Map<string, T>, n: number, toNum: (v: T) => number): Array<{ key: string; value: T }> {
	return Array.from(map.entries())
		.map(([key, value]) => ({ key, value }))
		.sort((a, b) => toNum(b.value) - toNum(a.value))
		.slice(0, n);
}

// Aggregate per-pageview to get unique-pageview metrics. An event row is one
// beacon; a "pageview" as a user-facing unit is all events with the same
// pageviewId. This lets us compute e.g. "sessions that hit 50% scroll".
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
	lastSeen: number;
	hadLeave: boolean;
	milestones: Set<number>;
}

function aggregatePageviews(events: EventRow[]): Map<string, PageviewAgg> {
	const byPv = new Map<string, PageviewAgg>();
	for (const e of events) {
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
				lastSeen: e.createdAtMs,
				hadLeave: false,
				milestones: new Set(),
			};
			byPv.set(e.pageviewId, pv);
		}
		pv.lastSeen = Math.max(pv.lastSeen, e.createdAtMs);
		const d = e.data as any;
		if (typeof d.scrollMax === "number") pv.maxScroll = Math.max(pv.maxScroll, d.scrollMax);
		if (typeof d.activeMs === "number") pv.activeMs = Math.max(pv.activeMs, d.activeMs);
		if (typeof d.dwellMs === "number") pv.dwellMs = Math.max(pv.dwellMs, d.dwellMs);
		if (typeof d.depth === "number") pv.milestones.add(d.depth);
		if (e.eventType === "leave") pv.hadLeave = true;
	}
	return byPv;
}

async function buildAnalyticsPage(ctx: PluginContext) {
	const now = Date.now();
	const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
	const dayAgo = now - 24 * 60 * 60 * 1000;

	const events = await loadEvents(ctx, sevenDaysAgo);
	const pageviews = aggregatePageviews(events);
	const pvArr = Array.from(pageviews.values());

	const totalPageviews = pvArr.length;
	const uniqueVisitors = new Set(pvArr.map((p) => p.visitorId).filter(Boolean)).size;
	const uniqueSessions = new Set(pvArr.map((p) => p.sessionId).filter(Boolean)).size;

	const pvLast24h = pvArr.filter((p) => p.firstSeen >= dayAgo).length;
	const visitorsLast24h = new Set(
		pvArr.filter((p) => p.firstSeen >= dayAgo).map((p) => p.visitorId).filter(Boolean),
	).size;

	// Reading-funnel on post pages
	const postPvs = pvArr.filter((p) => p.section === "post");
	const reached = {
		any: postPvs.length,
		m25: postPvs.filter((p) => p.milestones.has(25) || p.maxScroll >= 25).length,
		m50: postPvs.filter((p) => p.milestones.has(50) || p.maxScroll >= 50).length,
		m75: postPvs.filter((p) => p.milestones.has(75) || p.maxScroll >= 75).length,
		m100: postPvs.filter((p) => p.milestones.has(100) || p.maxScroll >= 100).length,
	};

	const avgActiveMs = postPvs.length > 0
		? Math.round(postPvs.reduce((s, p) => s + p.activeMs, 0) / postPvs.length)
		: 0;
	const avgDwellMs = postPvs.length > 0
		? Math.round(postPvs.reduce((s, p) => s + p.dwellMs, 0) / postPvs.length)
		: 0;

	// Bounce = single-pageview sessions
	const bySession = new Map<string, number>();
	for (const p of pvArr) {
		if (!p.sessionId) continue;
		bySession.set(p.sessionId, (bySession.get(p.sessionId) || 0) + 1);
	}
	const bouncedSessions = Array.from(bySession.values()).filter((c) => c === 1).length;
	const bounceRate = percent(bouncedSessions, bySession.size);

	// Lumos counts
	const allLumos = await ctx.storage.lumos!.query({});
	const lumosItems = flattenRows(allLumos.items ?? allLumos ?? []) as any[];

	// Top pages (7d, by pageviews)
	const pageAgg = new Map<string, { pv: number; visitors: Set<string>; totalActive: number; totalScroll: number; scrollN: number }>();
	for (const p of pvArr) {
		const key = p.path;
		let agg = pageAgg.get(key);
		if (!agg) {
			agg = { pv: 0, visitors: new Set(), totalActive: 0, totalScroll: 0, scrollN: 0 };
			pageAgg.set(key, agg);
		}
		agg.pv++;
		if (p.visitorId) agg.visitors.add(p.visitorId);
		agg.totalActive += p.activeMs;
		if (p.maxScroll > 0) {
			agg.totalScroll += p.maxScroll;
			agg.scrollN++;
		}
	}

	const topPages = topN(pageAgg, 15, (v) => v.pv).map(({ key, value }) => ({
		path: key,
		pageviews: value.pv,
		visitors: value.visitors.size,
		avg_scroll: (value.scrollN > 0 ? Math.round(value.totalScroll / value.scrollN) : 0) + "%",
		avg_time: formatDuration(value.pv > 0 ? Math.round(value.totalActive / value.pv) : 0),
	}));

	// Referrer hosts
	const refAgg = new Map<string, number>();
	for (const p of pvArr) {
		const h = p.refHost || "(direct)";
		refAgg.set(h, (refAgg.get(h) || 0) + 1);
	}
	const topRefs = topN(refAgg, 10, (v) => v).map(({ key, value }) => ({
		source: key,
		pageviews: value,
		share: percent(value, totalPageviews),
	}));

	return {
		blocks: [
			{ type: "header", text: "Analytics — last 7 days" },
			{
				type: "fields",
				fields: [
					{ label: "Pageviews (7d)", value: String(totalPageviews) },
					{ label: "Unique Visitors", value: String(uniqueVisitors) },
					{ label: "Sessions", value: String(uniqueSessions) },
					{ label: "Bounce Rate", value: bounceRate },
					{ label: "Pageviews (24h)", value: String(pvLast24h) },
					{ label: "Visitors (24h)", value: String(visitorsLast24h) },
					{ label: "Total Lumos", value: String(lumosItems.length) },
				],
			},
			{ type: "divider" },
			{ type: "header", text: "Reading Funnel (post pages, 7d)" },
			{
				type: "fields",
				fields: [
					{ label: "Pageviews", value: String(reached.any) },
					{ label: "Scrolled 25%", value: reached.m25 + " (" + percent(reached.m25, reached.any) + ")" },
					{ label: "Scrolled 50%", value: reached.m50 + " (" + percent(reached.m50, reached.any) + ")" },
					{ label: "Scrolled 75%", value: reached.m75 + " (" + percent(reached.m75, reached.any) + ")" },
					{ label: "Reached End", value: reached.m100 + " (" + percent(reached.m100, reached.any) + ")" },
					{ label: "Avg Active Time", value: formatDuration(avgActiveMs) },
					{ label: "Avg Dwell Time", value: formatDuration(avgDwellMs) },
				],
			},
			{ type: "divider" },
			{ type: "header", text: "Top Pages (7d)" },
			{
				type: "table",
				columns: [
					{ key: "path", label: "Path" },
					{ key: "pageviews", label: "Views", format: "number" },
					{ key: "visitors", label: "Visitors", format: "number" },
					{ key: "avg_scroll", label: "Avg Scroll" },
					{ key: "avg_time", label: "Avg Active" },
				],
				rows: topPages,
				empty_text: "No pageviews yet.",
			},
			{ type: "divider" },
			{ type: "header", text: "Top Referrers (7d)" },
			{
				type: "table",
				columns: [
					{ key: "source", label: "Source" },
					{ key: "pageviews", label: "Views", format: "number" },
					{ key: "share", label: "Share" },
				],
				rows: topRefs,
				empty_text: "No referrer data yet.",
			},
		],
	};
}

async function buildPagesPage(ctx: PluginContext) {
	const now = Date.now();
	const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
	const events = await loadEvents(ctx, thirtyDaysAgo);
	const pvs = Array.from(aggregatePageviews(events).values());

	// Per-path aggregates including milestone counts
	type PathAgg = {
		pv: number;
		visitors: Set<string>;
		totalActive: number;
		totalScroll: number;
		scrollN: number;
		m25: number; m50: number; m75: number; m100: number;
	};
	const pathAgg = new Map<string, PathAgg>();
	for (const p of pvs) {
		let a = pathAgg.get(p.path);
		if (!a) {
			a = { pv: 0, visitors: new Set(), totalActive: 0, totalScroll: 0, scrollN: 0, m25: 0, m50: 0, m75: 0, m100: 0 };
			pathAgg.set(p.path, a);
		}
		a.pv++;
		if (p.visitorId) a.visitors.add(p.visitorId);
		a.totalActive += p.activeMs;
		if (p.maxScroll > 0) { a.totalScroll += p.maxScroll; a.scrollN++; }
		if (p.milestones.has(25) || p.maxScroll >= 25) a.m25++;
		if (p.milestones.has(50) || p.maxScroll >= 50) a.m50++;
		if (p.milestones.has(75) || p.maxScroll >= 75) a.m75++;
		if (p.milestones.has(100) || p.maxScroll >= 100) a.m100++;
	}

	// Lumos counts per post
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

	// UTM breakdown
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

	function agg(selector: (p: PageviewAgg) => string): Array<{ k: string; v: number; share: string }> {
		const m = new Map<string, number>();
		for (const p of pvs) {
			const k = selector(p) || "(unknown)";
			m.set(k, (m.get(k) || 0) + 1);
		}
		const total = pvs.length;
		return Array.from(m.entries())
			.map(([k, v]) => ({ k, v, share: percent(v, total) }))
			.sort((a, b) => b.v - a.v);
	}

	const countries = agg((p) => p.country).map((r) => ({ bucket: r.k, pageviews: r.v, share: r.share }));
	const devices = agg((p) => p.device).map((r) => ({ bucket: r.k, pageviews: r.v, share: r.share }));
	const browsers = agg((p) => p.browser).map((r) => ({ bucket: r.k, pageviews: r.v, share: r.share }));

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
				rows: countries,
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
				rows: devices,
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
				rows: browsers,
				empty_text: "No browser data yet.",
			},
		],
	};
}

async function buildLivePage(ctx: PluginContext) {
	const now = Date.now();
	const fifteenMinAgo = now - 15 * 60 * 1000;
	const events = await loadEvents(ctx, fifteenMinAgo);

	// Active visitors = distinct visitors in last 5m
	const fiveMinAgo = now - 5 * 60 * 1000;
	const activeVisitors = new Set(events.filter((e) => e.createdAtMs >= fiveMinAgo).map((e) => e.visitorId).filter(Boolean));

	// Recent activity: last 50 events
	const recent = events.slice(-50).reverse().map((e) => ({
		when: e.createdAt,
		type: e.eventType,
		path: e.path,
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
					{ key: "when", label: "When", format: "relative_time" },
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

	return {
		blocks: [
			{
				type: "fields",
				fields: [
					{ label: "Pageviews", value: String(pvs.length) },
					{ label: "Visitors", value: String(visitors) },
					{ label: "Sessions", value: String(new Set(pvs.map((p) => p.sessionId).filter(Boolean)).size) },
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
	for (const p of pvs) agg.set(p.path, (agg.get(p.path) || 0) + 1);
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
		// Site-wide tracker is injected directly in src/layouts/Base.astro
		// (not via page:fragments). The EmDash page:fragments hook registers
		// without errors for in-process standard-format plugins but is never
		// invoked at render time in this emdash version, so we bake the
		// <script> into the layout instead.

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
					const body = (routeCtx.input ?? {}) as { email?: string };
					const email = body.email?.trim().toLowerCase();

					if (!email || !isValidEmail(email)) {
						return { error: "Invalid email address" };
					}

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

		// Site-wide analytics beacon. Enriched server-side with Cloudflare
		// edge signals (country, IP hash) and a lightweight UA classifier.
		beacon: {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				// The runtime pre-parses the request body into routeCtx.input;
				// calling request.json() here would fail because the stream is
				// already consumed. Fall back to request.json() only if input
				// is missing (e.g. sendBeacon sometimes posts as a Blob).
				let body: any = routeCtx.input;
				if (!body) {
					try {
						body = await routeCtx.request.json();
					} catch {
						return { error: "Invalid JSON" };
					}
				}

				const type = body.type || body.eventType;
				const path = body.path || "";
				const sessionId = body.s || body.sessionId || "";
				const visitorId = body.v || body.visitorId || sessionId;
				const pageviewId = body.pv || body.pageviewId || sessionId;

				if (!type || !sessionId) {
					return { error: "Missing required fields" };
				}

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

				const ref = body.ref || "";
				let refHost = "";
				if (ref) {
					try {
						const u = new URL(ref);
						if (u.host !== headers.get("host")) refHost = u.host;
					} catch {}
				}

				const { section, postSlug } = classifyPath(path);

				const eventData = body.data || {};
				const utm = (eventData.utm || {}) as Record<string, string>;

				const ts = body.t || Date.now();
				// 16-char random suffix keeps ids unique even at 1000 events/sec.
				const rid = Math.random().toString(36).slice(2, 10);
				const id = `${sessionId}_${type}_${ts}_${rid}`;

				try {
					await ctx.storage.reading_events.put(id, {
					id,
					path,
					qs: body.qs || "",
					section,
					postSlug,
					sessionId,
					visitorId,
					pageviewId,
					eventType: type,
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
					utmTerm: utm.utm_term || "",
					utmContent: utm.utm_content || "",
					title: body.title || "",
					vw: body.vw || 0,
					vh: body.vh || 0,
					dpr: body.dpr || 1,
					lang: body.lang || "",
					tz: body.tz || "",
					data: eventData,
					createdAt: new Date(ts).toISOString(),
				});
				} catch (err) {
					ctx.log.info(`[pensieve-engage] beacon put failed: ${err instanceof Error ? err.message : String(err)}`);
					return { error: "store failed" };
				}

				return { ok: true };
			},
		},

		admin: {
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const interaction = routeCtx.input;

				if (interaction.type === "page_load" && interaction.page === "widget:subscriber-stats") {
					return buildSubscriberStatsWidget(ctx);
				}
				if (interaction.type === "page_load" && interaction.page === "widget:traffic-stats") {
					return buildTrafficWidget(ctx);
				}
				if (interaction.type === "page_load" && interaction.page === "widget:top-pages-today") {
					return buildTopPagesTodayWidget(ctx);
				}

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

		"lumos/cast": {
			public: true,
			handler: async (routeCtx: any, ctx: PluginContext) => {
				const { postSlug } = routeCtx.input as { postSlug?: string };
				if (!postSlug) return { error: "Missing postSlug" };

				const ip = routeCtx.request.headers.get("cf-connecting-ip") || routeCtx.request.headers.get("x-forwarded-for") || "unknown";
				let ipHash = 0;
				for (let i = 0; i < ip.length; i++) {
					ipHash = ((ipHash << 5) - ipHash + ip.charCodeAt(i)) | 0;
				}
				const ipKey = `ip_${Math.abs(ipHash).toString(36)}`;

				const existing = await ctx.storage.lumos!.query({
					where: { postSlug, ipHash: ipKey },
					limit: 1,
				});

				if (existing.items.length > 0) {
					const total = await ctx.storage.lumos!.count({ postSlug });
					return { success: false, alreadyCast: true, count: total };
				}

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
