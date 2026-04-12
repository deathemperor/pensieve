import handler from "@astrojs/cloudflare/entrypoints/server";
import { HOME_HTML, HOME_FAVICON_SVG } from "./home-html";
export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

/**
 * Wrap the Astro Worker handler with a few custom routes:
 *
 *   /                         → huuloc.com landing page (static HTML)
 *   /favicon.svg              → favicon, shared with Pensieve
 *   /robots.txt               → bare allow-all
 *   /pensieve/m/<sha256>.ext  → proxy to R2 media bucket, 1-year cache
 *   everything else           → Astro (Pensieve at /pensieve/*)
 */
export default {
	async fetch(request: Request, env: any, ctx: any) {
		const url = new URL(request.url);
		const path = url.pathname;

		// Root landing page for huuloc.com/
		if (path === "/" || path === "") {
			return new Response(HOME_HTML, {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
					"Cache-Control": "public, max-age=300, s-maxage=3600",
				},
			});
		}

		// Favicon at the domain root (Pensieve serves its own at /pensieve/favicon.svg)
		if (path === "/favicon.svg" || path === "/favicon.ico") {
			return new Response(HOME_FAVICON_SVG, {
				headers: {
					"Content-Type": "image/svg+xml",
					"Cache-Control": "public, max-age=86400",
				},
			});
		}

		if (path === "/robots.txt") {
			return new Response(
				"User-agent: *\nAllow: /\n\nSitemap: https://huuloc.com/pensieve/rss-en.xml\nSitemap: https://huuloc.com/pensieve/rss-vi.xml\n",
				{
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				},
			);
		}

		// Unlisted plant gallery served from dist/client/plant-gallery/*
		if (path === "/plant-gallery" || path === "/plant-gallery/") {
			return env.ASSETS.fetch(
				new Request(new URL("/plant-gallery/index.html", url), request),
			);
		}
		if (path.startsWith("/plant-gallery/")) {
			return env.ASSETS.fetch(request);
		}

		// R2 media proxy for Pensieve
		const mediaPrefix = "/pensieve/m/";
		if (path.startsWith(mediaPrefix) && env.MEDIA) {
			const key = path.slice(mediaPrefix.length);
			if (!/^[a-z0-9]+\.(jpg|jpeg|png|webp|gif)$/i.test(key)) {
				return new Response("Invalid media key", { status: 400 });
			}
			const obj = await env.MEDIA.get(`media/${key}`);
			if (!obj) {
				return new Response("Not found", { status: 404 });
			}
			return new Response(obj.body, {
				headers: {
					"Content-Type":
						obj.httpMetadata?.contentType ||
						(key.endsWith(".jpg") || key.endsWith(".jpeg")
							? "image/jpeg"
							: key.endsWith(".png")
								? "image/png"
								: "application/octet-stream"),
					"Cache-Control": "public, max-age=31536000, immutable",
					"Access-Control-Allow-Origin": "*",
				},
			});
		}

		// Everything else (mainly /pensieve/*) goes to the Astro handler.
		// Requests outside /pensieve/ that aren't any of the routes above fall
		// through to Astro's 404 page — acceptable since we only expect
		// traffic at /, /pensieve/*, and /favicon.svg.
		return handler.fetch(request, env, ctx);
	},
};
