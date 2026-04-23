import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { parseFolderId } from "../../../../../lib/portraits/drive";

export const prerender = false;

interface PostBody { folder: string; label?: string; enabled?: boolean }

export const GET: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const rs = await db
    .prepare("SELECT folder_id, label, enabled, last_scanned_at, last_status, last_error, last_new_count FROM drive_scan_folders ORDER BY created_at DESC")
    .all();
  return json({ folders: rs.results ?? [] });
};

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  let body: PostBody;
  try { body = await ctx.request.json() as PostBody; }
  catch { return json({ error: "invalid_json" }, 400); }
  if (typeof body.folder !== "string") return json({ error: "folder_required" }, 400);

  const folderId = parseFolderId(body.folder);
  if (!folderId) return json({ error: "invalid_folder" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO drive_scan_folders (folder_id, label, enabled, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(folder_id) DO UPDATE SET
        label = COALESCE(excluded.label, drive_scan_folders.label),
        enabled = excluded.enabled
    `)
    .bind(folderId, body.label ?? null, body.enabled === false ? 0 : 1, now)
    .run();

  return json({ ok: true, folder_id: folderId });
};

export const DELETE: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const url = new URL(ctx.request.url);
  const folder = url.searchParams.get("folder");
  if (!folder) return json({ error: "folder_required" }, 400);

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  await db.prepare("DELETE FROM drive_scan_folders WHERE folder_id = ?").bind(folder).run();
  return json({ ok: true });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
