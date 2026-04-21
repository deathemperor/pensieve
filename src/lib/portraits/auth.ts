import type { AstroGlobal } from "astro";

const ADMIN_ROLE_THRESHOLD = 50;

export interface AuthUser {
  role: number;
  email: string;
}

export interface AuthCheckResult {
  admin: boolean;
  user: AuthUser | null;
}

export function isAdminResponse(
  status: number,
  body: unknown,
): boolean {
  if (status !== 200) return false;
  if (!body || typeof body !== "object") return false;
  const user = (body as { user?: { role?: unknown } }).user;
  if (!user || typeof user !== "object") return false;
  const role = (user as { role?: unknown }).role;
  return typeof role === "number" && role >= ADMIN_ROLE_THRESHOLD;
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
  const user = admin ? (body as { user: AuthUser }).user : null;
  return { admin, user };
}
