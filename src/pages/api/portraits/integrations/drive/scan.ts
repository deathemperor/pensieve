import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { ulid } from "../../../../../lib/portraits/ulid";
import { extractContactFromCard } from "../../../../../lib/portraits/ocr";
import { getAccessToken, listImageFilesInFolder, downloadFile } from "../../../../../lib/portraits/drive";

export const prerender = false;

export interface ScanOutcome {
  folder_id: string;
  listed: number;
  new_files: number;
  processed_ok: number;
  skipped: number;
  failed: number;
  errors: Array<{ file_id: string; error: string }>;
}

export async function scanFolder(
  envAny: any,
  folderId: string,
  options: { limit?: number } = {},
): Promise<{ ok: true; outcome: ScanOutcome } | { ok: false; error: string }> {
  const e = envAny;
  const kv = e.SESSION as import("@cloudflare/workers-types").KVNamespace;
  const db = e.DB as import("@cloudflare/workers-types").D1Database;
  const r2 = e.MEDIA as import("@cloudflare/workers-types").R2Bucket;
  const clientId = e.GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  const clientSecret = e.GOOGLE_OAUTH_CLIENT_SECRET as string | undefined;
  const anthropicKey = e.ANTHROPIC_API_KEY as string | undefined;

  if (!clientId || !clientSecret) return { ok: false, error: "google_oauth_not_configured" };

  const tok = await getAccessToken(kv, clientId, clientSecret);
  if (!tok.ok) return { ok: false, error: (tok as { ok: false; error: string }).error };

  const list = await listImageFilesInFolder(tok.value, folderId, options.limit ?? 200);
  if (!list.ok) return { ok: false, error: (list as { ok: false; error: string }).error };

  const outcome: ScanOutcome = {
    folder_id: folderId,
    listed: list.value.length,
    new_files: 0,
    processed_ok: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // One query per batch of ≤100 file IDs to find already-processed ones.
  const existingIds = new Set<string>();
  if (list.value.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < list.value.length; i += chunkSize) {
      const chunk = list.value.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => "?").join(",");
      const rs = await db
        .prepare(`SELECT file_id FROM drive_processed_files WHERE file_id IN (${placeholders})`)
        .bind(...chunk.map((f) => f.id))
        .all<{ file_id: string }>();
      for (const r of (rs.results ?? [])) existingIds.add(r.file_id);
    }
  }

  for (const file of list.value) {
    if (existingIds.has(file.id)) { outcome.skipped++; continue; }
    outcome.new_files++;

    const dl = await downloadFile(tok.value, file.id);
    if (!dl.ok) {
      outcome.failed++;
      const errMsg = (dl as { ok: false; error: string }).error;
      outcome.errors.push({ file_id: file.id, error: errMsg });
      await db
        .prepare(`INSERT INTO drive_processed_files (file_id, folder_id, processed_at, status, error) VALUES (?,?,?,?,?)`)
        .bind(file.id, folderId, new Date().toISOString(), "failed", errMsg)
        .run();
      continue;
    }

    const mime = dl.value.mimeType.toLowerCase();
    if (!(mime === "image/jpeg" || mime === "image/png" || mime === "image/webp")) {
      outcome.skipped++;
      await db
        .prepare(`INSERT INTO drive_processed_files (file_id, folder_id, processed_at, status, error) VALUES (?,?,?,?,?)`)
        .bind(file.id, folderId, new Date().toISOString(), "skipped", `unsupported_mime_${mime}`)
        .run();
      continue;
    }

    const cardId = ulid();
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
    const r2Key = `portraits/cards/${cardId}.${ext}`;
    const now = new Date().toISOString();

    try {
      await r2.put(r2Key, dl.value.bytes, { httpMetadata: { contentType: mime } });
      await db
        .prepare(`INSERT INTO contact_cards (id, r2_key, captured_at, ocr_status, ocr_provider) VALUES (?,?,?,?,?)`)
        .bind(cardId, r2Key, now, "pending", "claude-vision-drive")
        .run();

      if (anthropicKey) {
        await db.prepare("UPDATE contact_cards SET ocr_status='parsing' WHERE id=?").bind(cardId).run();
        const result = await extractContactFromCard(anthropicKey, dl.value.bytes, mime as "image/jpeg" | "image/png" | "image/webp");
        if (result.ok) {
          await db.prepare(`UPDATE contact_cards SET ocr_status='parsed', extracted=?, error=NULL WHERE id=?`)
            .bind(JSON.stringify(result.value), cardId).run();
        } else {
          const errMsg = (result as { ok: false; error: string }).error;
          await db.prepare(`UPDATE contact_cards SET ocr_status='failed', error=? WHERE id=?`).bind(errMsg, cardId).run();
        }
      }

      await db
        .prepare(`INSERT INTO drive_processed_files (file_id, folder_id, card_id, processed_at, status) VALUES (?,?,?,?,?)`)
        .bind(file.id, folderId, cardId, now, "ok")
        .run();
      outcome.processed_ok++;
    } catch (err) {
      outcome.failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      outcome.errors.push({ file_id: file.id, error: errMsg });
      await db
        .prepare(`INSERT INTO drive_processed_files (file_id, folder_id, processed_at, status, error) VALUES (?,?,?,?,?)`)
        .bind(file.id, folderId, new Date().toISOString(), "failed", errMsg)
        .run();
    }
  }

  await db
    .prepare(`
      UPDATE drive_scan_folders
         SET last_scanned_at = ?,
             last_status = ?,
             last_error = ?,
             last_new_count = ?
       WHERE folder_id = ?
    `)
    .bind(
      new Date().toISOString(),
      outcome.failed === 0 ? "ok" : (outcome.processed_ok > 0 ? "partial" : "error"),
      outcome.errors.length > 0 ? JSON.stringify(outcome.errors.slice(0, 3)) : null,
      outcome.new_files,
      folderId,
    )
    .run();

  return { ok: true, outcome };
}

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  let body: { folder_id?: string; limit?: number } = {};
  try { body = await ctx.request.json() as any; } catch { /* empty body ok */ }

  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const folderId = body.folder_id;
  if (!folderId) {
    const rs = await db.prepare("SELECT folder_id FROM drive_scan_folders WHERE enabled = 1").all<{ folder_id: string }>();
    const outcomes: ScanOutcome[] = [];
    for (const r of (rs.results ?? [])) {
      const result = await scanFolder(env, r.folder_id, { limit: body.limit });
      if (result.ok) outcomes.push(result.outcome);
    }
    return json({ ok: true, outcomes });
  }

  const result = await scanFolder(env, folderId, { limit: body.limit });
  if (!result.ok) return json({ error: (result as { ok: false; error: string }).error }, 502);
  return json({ ok: true, outcome: result.outcome });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
