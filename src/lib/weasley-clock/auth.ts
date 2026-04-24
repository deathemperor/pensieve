// Auth gate for Weasley Clock admin API routes.
// Mirrors the pattern from src/lib/portraits/auth.ts — forwards the request's
// cookie to EmDash's /_emdash/api/auth/me and checks role >= admin threshold.

const ADMIN_ROLE_THRESHOLD = 50;

export async function requireAdminFromRequest(request: Request): Promise<boolean> {
	const cookie = request.headers.get("cookie") ?? "";
	if (!cookie) return false;
	const url = new URL(request.url);
	const meUrl = new URL("/_emdash/api/auth/me", url.origin);
	try {
		const res = await fetch(meUrl, { headers: { cookie } });
		if (!res.ok) return false;
		const body = (await res.json()) as { user?: { role?: unknown } };
		const role = body.user?.role;
		return typeof role === "number" && role >= ADMIN_ROLE_THRESHOLD;
	} catch {
		return false;
	}
}

export function forbidden(): Response {
	return new Response(
		JSON.stringify({ error: "forbidden" }),
		{ status: 403, headers: { "Content-Type": "application/json" } },
	);
}
