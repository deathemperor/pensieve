import handler from "@astrojs/cloudflare/entrypoints/server";
export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

/**
 * Custom worker wrapping the Astro handler.
 *
 * With base: "/" Astro owns the entire domain. The worker only
 * intercepts routes that need special handling:
 *   /plant-gallery/*  → static assets (outside Astro)
 *   /pensieve/m/*     → R2 media proxy, 1-year cache
 *   /trương           → 301 redirect to canonical /Trương
 *   everything else   → Astro
 */
export default {
	async fetch(request: Request, env: any, ctx: any) {
		const url = new URL(request.url);
		const path = url.pathname;

		// Plant gallery — static assets outside Astro
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

		// EmDash admin bug: limit=100 crashes with CONTENT_LIST_ERROR.
		// Retry with limit=99 if the original request fails.
		if (
			path.startsWith("/_emdash/api/content/") &&
			url.searchParams.get("limit") === "100"
		) {
			const response = await handler.fetch(request, env, ctx);
			if (response.status === 500) {
				url.searchParams.set("limit", "99");
				const retryReq = new Request(url.toString(), {
					method: request.method,
					headers: request.headers,
					body: request.body,
				});
				return handler.fetch(retryReq, env, ctx);
			}
			return response;
		}

		// Lowercase /trương → canonical /Trương
		if (path.startsWith("/tr\u01B0\u01A1ng")) {
			const canonical = path.replace("/tr\u01B0\u01A1ng", "/Tr\u01B0\u01A1ng");
			return Response.redirect(new URL(canonical, url.origin).href, 301);
		}

		// Everything else → Astro
		return handler.fetch(request, env, ctx);
	},
};
