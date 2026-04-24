import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { requireAdmin } from "../../../../../lib/portraits/auth";
import { createContact } from "../../../../../lib/portraits/db";
import type { CreateContactInput } from "../../../../../lib/portraits/types";

export const prerender = false;

interface PeopleConnection {
  resourceName: string; // people/c12345
  names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>;
  emailAddresses?: Array<{ value?: string; type?: string }>;
  phoneNumbers?: Array<{ value?: string; type?: string }>;
  organizations?: Array<{ name?: string; title?: string; domain?: string }>;
  biographies?: Array<{ value?: string }>;
}

export const POST: APIRoute = async (ctx) => {
  const auth = await requireAdmin(ctx as any);
  if (!auth.admin) return json({ error: "forbidden" }, 403);

  const e = env as any;
  const kv = e.SESSION as import("@cloudflare/workers-types").KVNamespace;
  const db = e.DB as import("@cloudflare/workers-types").D1Database;

  const refresh = await kv.get("portraits:integration:google:refresh");
  if (!refresh) return json({ error: "not_connected", hint: "Visit /api/portraits/integrations/google/start to connect." }, 400);

  const clientId = e.GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  const clientSecret = e.GOOGLE_OAUTH_CLIENT_SECRET as string | undefined;
  if (!clientId || !clientSecret) return json({ error: "oauth_not_configured" }, 503);

  // Refresh access token
  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!tokRes.ok) {
    const txt = await tokRes.text().catch(() => "");
    return json({ error: `refresh_failed: ${tokRes.status} ${txt}` }, 502);
  }
  const tok = await tokRes.json() as { access_token?: string };
  const accessToken = tok.access_token;
  if (!accessToken) return json({ error: "no_access_token" }, 502);

  // Walk all connections, paginating
  const fields = "names,emailAddresses,phoneNumbers,organizations,biographies";
  let pageToken: string | undefined;
  const connections: PeopleConnection[] = [];

  do {
    const params = new URLSearchParams({
      personFields: fields,
      pageSize: "200",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const pRes = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!pRes.ok) {
      const txt = await pRes.text().catch(() => "");
      return json({ error: `people_api_failed: ${pRes.status} ${txt}` }, 502);
    }
    const body = await pRes.json() as { connections?: PeopleConnection[]; nextPageToken?: string };
    if (body.connections) connections.push(...body.connections);
    pageToken = body.nextPageToken;
    if (connections.length > 10000) break; // safety cap
  } while (pageToken);

  // For dedup, load existing google resourceNames
  const existingRs = await db
    .prepare("SELECT id, json_extract(external_ids, '$.google_resource_name') AS g FROM contacts WHERE json_extract(external_ids, '$.google_resource_name') IS NOT NULL AND deleted_at IS NULL")
    .all<{ id: string; g: string }>();
  const byResource = new Map<string, string>();
  for (const r of (existingRs.results ?? [])) byResource.set(r.g, r.id);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ resource: string; error: string }> = [];

  for (const conn of connections) {
    const resourceName = conn.resourceName;
    const full_name = conn.names?.[0]?.displayName ?? "";
    if (!full_name.trim()) { skipped++; continue; }

    const emails = (conn.emailAddresses ?? []).map((x) => x.value).filter((v): v is string => !!v);
    const phones = (conn.phoneNumbers ?? []).map((x) => x.value).filter((v): v is string => !!v);
    const org = conn.organizations?.[0];
    const bio = conn.biographies?.[0]?.value;

    if (byResource.has(resourceName)) {
      // Already imported — skip updates for now (Phase 8.5 can add smart sync)
      updated++;
      continue;
    }

    try {
      const input: CreateContactInput = {
        full_name,
        title: org?.title ?? null,
        company: org?.name ?? null,
        company_domain: org?.domain ?? null,
        prestige_tier: "D",
        source: "google",
        bio: bio ?? null,
        channels: [
          ...emails.map((v, i) => ({ kind: "email" as const, value: v, is_primary: i === 0 })),
          ...phones.map((v) => ({ kind: "phone" as const, value: v, is_primary: false })),
        ],
      };
      const row = await createContact(db, input);
      // Tag external_ids with the google resource for future dedup
      await db
        .prepare("UPDATE contacts SET external_ids = json_set(COALESCE(external_ids, '{}'), '$.google_resource_name', ?) WHERE id = ?")
        .bind(resourceName, row.id)
        .run();
      created++;
    } catch (err) {
      errors.push({ resource: resourceName, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await kv.put("portraits:integration:google:last_sync", new Date().toISOString());

  return json({ ok: true, counts: { fetched: connections.length, created, updated, skipped }, errors });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
