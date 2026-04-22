import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../lib/portraits/auth";

export const prerender = false;

interface SendBody {
  contact_id: string;
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  let body: SendBody;
  try { body = await ctx.request.json() as SendBody; }
  catch { return json({ error: "invalid_json" }, 400); }

  for (const field of ["contact_id", "to", "subject", "body"] as const) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return json({ error: `${field}_required` }, 400);
    }
  }

  const apiKey = (env as any).RESEND_API_KEY as string | undefined;
  if (!apiKey) return json({ error: "resend_unavailable", hint: "set RESEND_API_KEY via wrangler secret" }, 503);

  const from = body.from ?? (env as any).PORTRAITS_OUTREACH_FROM ?? "loc@huuloc.com";

  let resendResponse: { id?: string; error?: unknown };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [body.to],
        subject: body.subject,
        text: body.body,
      }),
    });
    resendResponse = await r.json() as any;
    if (!r.ok) {
      return json({ error: "resend_error", detail: resendResponse }, 502);
    }
  } catch (e) {
    return json({ error: `network_error: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }

  // Log as interaction
  const db = (env as any).DB as import("@cloudflare/workers-types").D1Database;
  const id = ulid();
  const now = new Date().toISOString();
  await db
    .prepare(`INSERT INTO contact_interactions (id, contact_id, kind, body, happened_at, metadata, created_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(
      id, body.contact_id, "email_sent",
      `${body.subject}\n\n${body.body}`.slice(0, 4000),
      now,
      JSON.stringify({ resend_message_id: resendResponse.id, to: body.to, from }),
      now,
    )
    .run();

  return json({ ok: true, resend_id: resendResponse.id ?? null, interaction_id: id });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
function ulid(): string {
  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const now = Date.now();
  const rand = crypto.getRandomValues(new Uint8Array(10));
  let time = "", t = now;
  for (let i = 0; i < 10; i++) { time = CROCKFORD[t % 32] + time; t = Math.floor(t / 32); }
  let rs = "", bits = 0, acc = 0;
  for (let i = 0; i < 10; i++) { acc = (acc << 8) | rand[i]; bits += 8; while (bits >= 5) { bits -= 5; rs += CROCKFORD[(acc >> bits) & 31]; } }
  return time + rs;
}
