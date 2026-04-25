#!/usr/bin/env tsx
// scripts/fetch-app-store-icons.ts
//
// For each iPhone app in IPHONE_APPS below (sourced from Loc's
// Settings > iPhone Storage screenshots, sorted by Last Used Date),
// look up artwork + App Store URL via the iTunes Search API
// (country=vn, fall back to us), download the icon to
// public/arsenal/icons/iphone/, and emit a draft TS block.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ICON_OUT = "public/arsenal/icons/iphone";

type Bucket = "today" | "this_week" | "this_month" | "rare";

interface IPhoneApp {
	slug: string;
	searchTerm: string;
	displayTitle: string;
	frequency: Bucket;
	homepageOverride?: string;
}

const IPHONE_APPS: IPhoneApp[] = [
	// Today (28)
	{ slug: "settings", searchTerm: "iOS Settings", displayTitle: "Settings", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "zalo", searchTerm: "Zalo", displayTitle: "Zalo", frequency: "today" },
	{ slug: "google-maps", searchTerm: "Google Maps", displayTitle: "Google Maps", frequency: "today" },
	{ slug: "youtube", searchTerm: "YouTube", displayTitle: "YouTube", frequency: "today" },
	{ slug: "safari", searchTerm: "Safari", displayTitle: "Safari", frequency: "today", homepageOverride: "https://www.apple.com/safari/" },
	{ slug: "github-mobile", searchTerm: "GitHub", displayTitle: "GitHub", frequency: "today" },
	{ slug: "reddit", searchTerm: "Reddit", displayTitle: "Reddit", frequency: "today" },
	{ slug: "google", searchTerm: "Google", displayTitle: "Google", frequency: "today" },
	{ slug: "messenger", searchTerm: "Messenger", displayTitle: "Messenger", frequency: "today" },
	{ slug: "claude", searchTerm: "Claude by Anthropic", displayTitle: "Claude", frequency: "today" },
	{ slug: "google-photos", searchTerm: "Google Photos", displayTitle: "Google Photos", frequency: "today" },
	{ slug: "vnexpress", searchTerm: "VnExpress", displayTitle: "VnExpress", frequency: "today" },
	{ slug: "photos", searchTerm: "Photos", displayTitle: "Photos", frequency: "today", homepageOverride: "https://www.apple.com/ios/photos/" },
	{ slug: "facebook", searchTerm: "Facebook", displayTitle: "Facebook", frequency: "today" },
	{ slug: "hacki", searchTerm: "Hacki Hacker News", displayTitle: "Hacki", frequency: "today" },
	{ slug: "music", searchTerm: "Apple Music", displayTitle: "Music", frequency: "today" },
	{ slug: "camera", searchTerm: "iOS Camera", displayTitle: "Camera", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "phone", searchTerm: "iOS Phone", displayTitle: "Phone", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "clock", searchTerm: "iOS Clock", displayTitle: "Clock", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "find-my", searchTerm: "Find My", displayTitle: "Find My", frequency: "today" },
	{ slug: "techcombank", searchTerm: "Techcombank Mobile", displayTitle: "Techcombank", frequency: "today" },
	{ slug: "linkedin", searchTerm: "LinkedIn", displayTitle: "LinkedIn", frequency: "today" },
	{ slug: "telegram", searchTerm: "Telegram Messenger", displayTitle: "Telegram", frequency: "today" },
	{ slug: "calendar", searchTerm: "iOS Calendar", displayTitle: "Calendar", frequency: "today", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "gmail", searchTerm: "Gmail", displayTitle: "Gmail", frequency: "today" },
	{ slug: "daily-mail", searchTerm: "Daily Mail Online", displayTitle: "Daily Mail", frequency: "today" },
	{ slug: "grab", searchTerm: "Grab", displayTitle: "Grab", frequency: "today" },
	{ slug: "messages", searchTerm: "iOS Messages", displayTitle: "Messages", frequency: "today", homepageOverride: "https://www.apple.com/ios/messages/" },
	// Yesterday → this_week bucket
	{ slug: "x-twitter", searchTerm: "X formerly Twitter", displayTitle: "X", frequency: "this_week" },
	{ slug: "livescore", searchTerm: "LiveScore", displayTitle: "LiveScore", frequency: "this_week" },
	{ slug: "day-one", searchTerm: "Day One Journal", displayTitle: "Day One", frequency: "this_week" },
	{ slug: "obsidian", searchTerm: "Obsidian", displayTitle: "Obsidian", frequency: "this_week" },
	{ slug: "facetime", searchTerm: "FaceTime", displayTitle: "FaceTime", frequency: "this_week", homepageOverride: "https://www.apple.com/facetime/" },
	{ slug: "whatsapp", searchTerm: "WhatsApp Messenger", displayTitle: "WhatsApp", frequency: "this_week" },
	{ slug: "octal", searchTerm: "Octal Hacker News", displayTitle: "Octal", frequency: "this_week" },
	// 4/23/26 → this_week
	{ slug: "speedtest", searchTerm: "Speedtest by Ookla", displayTitle: "Speedtest", frequency: "this_week" },
	{ slug: "mail", searchTerm: "iOS Mail", displayTitle: "Mail", frequency: "this_week", homepageOverride: "https://www.apple.com/ios/" },
	{ slug: "slack", searchTerm: "Slack", displayTitle: "Slack", frequency: "this_week" },
	{ slug: "teams", searchTerm: "Microsoft Teams", displayTitle: "Teams", frequency: "this_week" },
	{ slug: "app-store", searchTerm: "App Store", displayTitle: "App Store", frequency: "this_week", homepageOverride: "https://www.apple.com/app-store/" },
	{ slug: "momo", searchTerm: "MoMo Vi dien tu", displayTitle: "MoMo", frequency: "this_week" },
	{ slug: "uob-tmrw", searchTerm: "UOB TMRW Vietnam", displayTitle: "UOB TMRW VN", frequency: "this_week" },
	{ slug: "wyze", searchTerm: "Wyze", displayTitle: "Wyze", frequency: "rare" },
];

interface ITunesResult {
	artworkUrl512?: string;
	artworkUrl100?: string;
	trackViewUrl?: string;
	sellerUrl?: string;
}

async function lookup(term: string): Promise<ITunesResult | null> {
	for (const country of ["vn", "us"]) {
		const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&country=${country}&limit=1`;
		try {
			const res = await fetch(url);
			if (!res.ok) continue;
			const data = (await res.json()) as { results?: ITunesResult[] };
			if (data.results && data.results.length > 0) return data.results[0];
		} catch {}
	}
	return null;
}

async function downloadIcon(url: string, dest: string): Promise<boolean> {
	try {
		const res = await fetch(url);
		if (!res.ok) return false;
		const buf = Buffer.from(await res.arrayBuffer());
		writeFileSync(dest, buf);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	mkdirSync(ICON_OUT, { recursive: true });

	console.log(`// === DRAFT iPhone entries (${IPHONE_APPS.length}) ===`);
	for (const app of IPHONE_APPS) {
		const result = await lookup(app.searchTerm);
		const artwork = result?.artworkUrl512 ?? result?.artworkUrl100 ?? null;
		const homepage =
			app.homepageOverride ?? result?.sellerUrl ?? result?.trackViewUrl ?? "https://FIXME";
		let iconOk = false;
		if (artwork) {
			iconOk = await downloadIcon(artwork, join(ICON_OUT, `${app.slug}.png`));
		}
		console.log(`  {
    slug: ${JSON.stringify(app.slug)},
    title: ${JSON.stringify(app.displayTitle)},
    platform: "iphone",
    category: "FIXME",
    tier: "inventory",
    icon: ${JSON.stringify(`/arsenal/icons/iphone/${app.slug}.png`)},${iconOk ? "" : "  // FIXME: icon download failed"}
    homepageUrl: ${JSON.stringify(homepage)},
    role: { en: "FIXME", vi: "FIXME" },
    frequency: ${JSON.stringify(app.frequency)},
  },`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
