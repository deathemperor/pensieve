import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
	const url = new URL(context.request.url);

	// Workaround for EmDash admin bug: limit=100 causes CONTENT_LIST_ERROR (500)
	// on the posts API. Rewrite to limit=99 which works fine.
	if (
		url.pathname.startsWith("/_emdash/api/content/") &&
		url.searchParams.get("limit") === "100"
	) {
		url.searchParams.set("limit", "99");
		return next(new Request(url.toString(), context.request));
	}

	return next();
});
