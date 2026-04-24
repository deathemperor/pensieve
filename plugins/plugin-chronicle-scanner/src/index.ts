import type { PluginDescriptor } from "emdash";

/**
 * plugin-chronicle-scanner
 *
 * Listens for posts:afterSave (on `published` status) and walks the
 * saved post's Portable Text looking for date patterns. Each date that
 * isn't already covered by a Chronicle entry is created as a draft
 * entry (source=post-scan, source_id=`post:<slug>:<iso>`).
 *
 * The draft status keeps the public `/pensieve/chronicle` page quiet
 * while the admin reviews suggestions at `/_emdash/admin/content/chronicle`.
 */
export function chronicleScannerPlugin(): PluginDescriptor {
	return {
		id: "chronicle-scanner",
		version: "1.0.0",
		format: "standard",
		entrypoint: "plugin-chronicle-scanner/sandbox",
		options: {},
		capabilities: [
			"read:content",
			"write:content",
		],
		allowedHosts: [],
		storage: {
			// Track which (post-slug, iso-date) pairs we've already promoted,
			// so re-saving the post doesn't spawn duplicate drafts.
			scan_log: {
				indexes: ["postSlug", "isoDate", "createdAt"],
			},
		},
	};
}
