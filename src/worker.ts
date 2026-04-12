import handler from "@astrojs/cloudflare/entrypoints/server";
export { PluginBridge } from "@emdash-cms/cloudflare/sandbox";

/**
 * Wrap the Astro Worker handler so we can serve media files directly from R2
 * at /pensieve/m/<sha256>.<ext> — faster path than EmDash's media API for
 * bulk-uploaded content, and keeps the featured_image.src field simple
 * (no media-table plumbing).
 */
export default {
	async fetch(request: Request, env: any, ctx: any) {
		const url = new URL(request.url);
		const prefix = "/pensieve/m/";
		if (url.pathname.startsWith(prefix) && env.MEDIA) {
			const key = url.pathname.slice(prefix.length);
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
		return handler.fetch(request, env, ctx);
	},
};
