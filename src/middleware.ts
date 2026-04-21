// src/middleware.ts
import { defineMiddleware } from "astro/middleware";

export const onRequest = defineMiddleware(async (ctx, next) => {
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
