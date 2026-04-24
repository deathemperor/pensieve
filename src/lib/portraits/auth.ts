import type { AstroGlobal } from "astro";
import type { D1Database } from "@cloudflare/workers-types";

const ADMIN_ROLE_THRESHOLD = 50;

export interface AuthUser {
  role: number;
  email: string;
}

export interface AuthCheckResult {
  admin: boolean;
  user: AuthUser | null;
}

export type ContactAccess = "none" | "view" | "edit" | "admin";

export interface AccessResult {
  admin: boolean;            // true when caller is admin (bypasses collab checks)
  user: AuthUser | null;
  access: ContactAccess;     // finest-grained permission on this contact for this caller
}

export function accessRank(a: ContactAccess): number {
  return ({ none: 0, view: 1, edit: 2, admin: 3 } as const)[a];
}

// EmDash's /_emdash/api/auth/me has returned the user object under either
// {data: {...}} or {user: {...}} across versions. Accept either shape.
function extractUser(body: unknown): { role?: unknown; email?: unknown } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { data?: unknown; user?: unknown };
  const candidate = (b.data && typeof b.data === "object" ? b.data : null)
    ?? (b.user && typeof b.user === "object" ? b.user : null);
  return candidate as { role?: unknown; email?: unknown } | null;
}

export function isAdminResponse(
  status: number,
  body: unknown,
): boolean {
  if (status !== 200) return false;
  const user = extractUser(body);
  if (!user) return false;
  return typeof user.role === "number" && user.role >= ADMIN_ROLE_THRESHOLD;
}

export async function requireAdmin(
  Astro: AstroGlobal,
): Promise<AuthCheckResult> {
  const cookie = Astro.request.headers.get("cookie") ?? "";
  if (!cookie) return { admin: false, user: null };

  let res: Response;
  try {
    res = await fetch(new URL("/_emdash/api/auth/me", Astro.url), {
      headers: { cookie },
    });
  } catch {
    return { admin: false, user: null };
  }

  let body: unknown = null;
  if (res.ok) {
    try {
      body = await res.json();
    } catch {
      // non-JSON response — treat as not authed
      return { admin: false, user: null };
    }
  }

  const admin = isAdminResponse(res.status, body);
  const raw = extractUser(body);
  const user: AuthUser | null = raw && typeof raw.role === "number" && typeof raw.email === "string"
    ? { role: raw.role, email: raw.email }
    : null;
  return { admin, user };
}

/**
 * Resolve the caller's effective access on a specific contact.
 * Returns admin:true for any role>=50 account. Otherwise looks up
 * contact_collaborators by the session user's email.
 */
export async function resolveContactAccess(
  Astro: AstroGlobal,
  db: D1Database,
  contactId: string,
): Promise<AccessResult> {
  const base = await requireAdmin(Astro);
  if (base.admin) return { admin: true, user: base.user, access: "admin" };
  if (!base.user?.email) return { admin: false, user: null, access: "none" };

  const row = await db
    .prepare("SELECT access FROM contact_collaborators WHERE contact_id = ? AND email = ? LIMIT 1")
    .bind(contactId, base.user.email.toLowerCase().trim())
    .first<{ access: "view" | "edit" }>();

  if (!row) return { admin: false, user: base.user, access: "none" };
  return { admin: false, user: base.user, access: row.access };
}

/**
 * Enforce a minimum access requirement. Returns the AccessResult when
 * authorized, or a Response (404) when not. Caller should early-return the
 * response.
 *
 * NOTE: returns 404 rather than 403 for "none" to avoid existence-leak --
 * the caller learns nothing about whether a contact exists if they have no access.
 */
export async function requireContactAccess(
  Astro: AstroGlobal,
  db: D1Database,
  contactId: string,
  minAccess: "view" | "edit",
): Promise<AccessResult | Response> {
  const r = await resolveContactAccess(Astro, db, contactId);
  if (r.admin) return r;
  if (accessRank(r.access) < accessRank(minAccess)) {
    return new Response(
      JSON.stringify({ error: "not_found" }),
      { status: 404, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } },
    );
  }
  return r;
}
