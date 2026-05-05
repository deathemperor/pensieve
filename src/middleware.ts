// src/middleware.ts
import { defineMiddleware } from "astro/middleware";

// Profile page aliases — these resolve to /Trương (the canonical page)
// while keeping the requested URL in the browser bar. Maternal-surname
// alias /Huỳnh is treated as a first-class entry point.
const PROFILE_ALIASES = new Set([
  "/Huỳnh",
  "/Huỳnh/",
]);

export const onRequest = defineMiddleware(async (ctx, next) => {
  // Internal rewrite: serve /Trương content under /Huỳnh, URL bar unchanged.
  // pathname is already URL-decoded by Astro/Cloudflare.
  const path = ctx.url.pathname;
  if (PROFILE_ALIASES.has(path)) {
    return ctx.rewrite("/Trương");
  }

  const res = await next();
  // /hol/* is immutable archive content — cache aggressively at the edge.
  // Takedown POST endpoint must NOT be cached.
  if (
    ctx.url.pathname.startsWith("/hol/") &&
    ctx.url.pathname !== "/hol/takedown/"
  ) {
    res.headers.set(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );
  }
  return res;
});
