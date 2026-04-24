// Auth gate for Weasley Clock admin API routes.
// Uses Astro.locals.user (populated server-side by EmDash's auth middleware)
// rather than forwarding the session cookie. The EmDash session cookie is
// Path-scoped to /_emdash/*, so a browser fetch from the admin SPA to
// /api/weasley-clock/* doesn't include it — reading locals.user bypasses
// the scope mismatch since middleware has already run before our handler.

const ADMIN_ROLE_THRESHOLD = 50;

export function isAdmin(locals: any): boolean {
	const user = locals?.user;
	if (!user || typeof user.role !== "number") return false;
	return user.role >= ADMIN_ROLE_THRESHOLD;
}

export function forbidden(): Response {
	return new Response(
		JSON.stringify({ error: "forbidden" }),
		{ status: 403, headers: { "Content-Type": "application/json" } },
	);
}
