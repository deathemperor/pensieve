export type ArsenalPlatform = "macos" | "iphone" | "cli";

export type ArsenalCategory =
	| "ai"
	| "editor"
	| "terminal"
	| "messenger"
	| "finance"
	| "media"
	| "dev"
	| "system"
	| "reading"
	| "journal"
	| "transit"
	| "shopping"
	| "social";

export type ArsenalFrequency = "today" | "this_week" | "this_month" | "rare";

export type ArsenalTier = "wand" | "inventory";

export interface ArsenalItem {
	slug: string;
	title: string;
	platform: ArsenalPlatform;
	category: ArsenalCategory;
	tier: ArsenalTier;
	icon: string;
	homepageUrl: string;
	role: { en: string; vi: string };
	note?: { en: string; vi: string };
	frequency: ArsenalFrequency;
	lastUsedAt?: string;
}

export const ARSENAL_PLATFORMS: ArsenalPlatform[] = ["macos", "iphone", "cli"];

export const ARSENAL_CATEGORIES: ArsenalCategory[] = [
	"ai",
	"editor",
	"terminal",
	"messenger",
	"finance",
	"media",
	"dev",
	"system",
	"reading",
	"journal",
	"transit",
	"shopping",
	"social",
];

export const ARSENAL_FREQUENCIES: ArsenalFrequency[] = [
	"today",
	"this_week",
	"this_month",
	"rare",
];

export const arsenal: ArsenalItem[] = [];
