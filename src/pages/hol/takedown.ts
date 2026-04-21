// src/pages/hol/takedown.ts
//
// Handles POST /hol/takedown/ — records a removal request.
// v1: records into HOL_DB.takedown_requests; human review + hide flip
// happens out-of-band via the admin CLI on ~/death/hol.
// v2: wire to pensieve's plugin-resend for an email alert.
import type { APIRoute } from "astro";
import { getHolDb } from "../../lib/hol/db";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const url   = String(form.get("url")   ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();

  if (!email || !url) {
    return new Response("email and url required", { status: 400 });
  }

  const db = getHolDb();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS takedown_requests (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT NOT NULL,
      url        TEXT NOT NULL,
      reason     TEXT,
      submitted_at INTEGER NOT NULL,
      handled    INTEGER NOT NULL DEFAULT 0
    )
  `).run();
  await db.prepare(`
    INSERT INTO takedown_requests(email, url, reason, submitted_at)
    VALUES (?, ?, ?, ?)
  `).bind(email, url, reason || null, Math.floor(Date.now() / 1000)).run();

  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Received</title>
     <body style="font:15px system-ui;padding:2rem;max-width:600px;margin:auto">
     <h1>Received</h1>
     <p>Your request has been logged. We'll email you at <strong>${escapeHtml(email)}</strong> once it's processed.</p>
     <p><a href="/hol/">Back to HOL Archive</a></p>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
