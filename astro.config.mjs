import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import { formsPlugin } from "@emdash-cms/plugin-forms";
import { webhookNotifierPlugin } from "@emdash-cms/plugin-webhook-notifier";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

export default defineConfig({
	site: "https://huuloc.com",
	base: "/pensieve",
	output: "server",
	adapter: cloudflare(),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: d1({ binding: "DB", session: "auto" }),
			storage: r2({ binding: "MEDIA" }),
			plugins: [formsPlugin()],
			sandboxed: [webhookNotifierPlugin()],
			sandboxRunner: sandbox(),
			marketplace: "https://marketplace.emdashcms.com",
		}),
	],
	devToolbar: { enabled: false },
	vite: {
		// EmDash's sandboxed plugins don't play well with Vite's dep optimizer
		// in SSR mode — the pre-bundled chunks disappear between page reloads
		// and we get SQLITE_CORRUPT_VTAB-style MIGHT-NOT-EXIST errors. Excluding
		// them from optimizeDeps forces Vite to load them fresh each time.
		optimizeDeps: {
			exclude: [
				"@emdash-cms/plugin-forms",
				"@emdash-cms/plugin-webhook-notifier",
				"@emdash-cms/cloudflare/sandbox",
				"@emdash-cms/cloudflare/storage/r2",
			],
		},
		ssr: {
			noExternal: [
				"@emdash-cms/plugin-forms",
				"@emdash-cms/plugin-webhook-notifier",
			],
		},
	},
});
