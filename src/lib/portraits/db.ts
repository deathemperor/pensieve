import type {
  Contact,
  ContactWithChannels,
  Channel,
  CreateContactInput,
  ListContactsOptions,
  TierCode,
} from "./types";
import { ulid } from "./ulid";

type D1 = import("@cloudflare/workers-types").D1Database;

export async function listContacts(
  db: D1,
  opts: ListContactsOptions,
): Promise<Contact[]> {
  const clauses: string[] = ["deleted_at IS NULL"];
  const binds: unknown[] = [];

  if (opts.onlyPlaceholders) {
    clauses.push("is_placeholder = 1");
  } else if (!opts.includePlaceholders) {
    clauses.push("is_placeholder = 0");
  }

  if (opts.tiers && opts.tiers.length > 0) {
    const placeholders = opts.tiers.map(() => "?").join(",");
    clauses.push(`prestige_tier IN (${placeholders})`);
    binds.push(...opts.tiers);
  }

  if (opts.search && opts.search.trim()) {
    clauses.push(
      "(full_name LIKE ? OR company LIKE ? OR tags LIKE ?)",
    );
    const q = `%${opts.search.trim()}%`;
    binds.push(q, q, q);
  }

  const sql =
    `SELECT * FROM contacts WHERE ${clauses.join(" AND ")} ` +
    `ORDER BY CASE prestige_tier WHEN 'S' THEN 0 WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 END, ` +
    `tier_score DESC, updated_at DESC`;

  const stmt = db.prepare(sql);
  const rs = binds.length ? await stmt.bind(...binds).all<Contact>() : await stmt.all<Contact>();
  return (rs.results ?? []) as Contact[];
}

export async function getContact(
  db: D1,
  id: string,
): Promise<ContactWithChannels | null> {
  const c = await db
    .prepare("SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<Contact>();
  if (!c) return null;

  const ch = await db
    .prepare(
      "SELECT * FROM contact_channels WHERE contact_id = ? ORDER BY is_primary DESC, created_at ASC",
    )
    .bind(id)
    .all<Channel>();

  return { ...c, channels: (ch.results ?? []) as Channel[] };
}

export async function createContact(
  db: D1,
  input: CreateContactInput,
): Promise<ContactWithChannels> {
  const now = new Date().toISOString();
  const id = ulid();

  const tags = input.tags ? JSON.stringify(input.tags) : null;
  const source = input.source ?? "manual";
  const tier_score = input.tier_score ?? 50;

  await db
    .prepare(
      `INSERT INTO contacts
         (id, full_name, display_name, title, company, company_domain,
          prestige_tier, tier_score, location, bio, source, tags,
          is_placeholder, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`,
    )
    .bind(
      id,
      input.full_name,
      input.display_name ?? null,
      input.title ?? null,
      input.company ?? null,
      input.company_domain ?? null,
      input.prestige_tier,
      tier_score,
      input.location ?? null,
      input.bio ?? null,
      source,
      tags,
      now,
      now,
    )
    .run();

  const channels: Channel[] = [];
  if (input.channels) {
    for (const ch of input.channels) {
      const chId = ulid();
      await db
        .prepare(
          `INSERT INTO contact_channels
             (id, contact_id, kind, value, label, is_primary, created_at)
           VALUES (?,?,?,?,?,?,?)`,
        )
        .bind(
          chId,
          id,
          ch.kind,
          ch.value,
          ch.label ?? null,
          ch.is_primary ? 1 : 0,
          now,
        )
        .run();
      channels.push({
        id: chId,
        contact_id: id,
        kind: ch.kind,
        value: ch.value,
        label: ch.label ?? null,
        is_primary: ch.is_primary ? 1 : 0,
        created_at: now,
      });
    }
  }

  const full = await getContact(db, id);
  if (!full) throw new Error("createContact: row vanished after insert");
  return full;
}

export interface UpdateContactInput {
  full_name?: string;
  display_name?: string | null;
  title?: string | null;
  company?: string | null;
  company_domain?: string | null;
  prestige_tier?: TierCode;
  tier_score?: number;
  location?: string | null;
  bio?: string | null;
  tags?: string[];
  birthday?: string | null;
}

export async function updateContact(
  db: D1,
  id: string,
  patch: UpdateContactInput,
): Promise<ContactWithChannels | null> {
  const existing = await getContact(db, id);
  if (!existing) return null;

  const fields: string[] = [];
  const binds: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === "tags") {
      fields.push("tags = ?");
      binds.push(value ? JSON.stringify(value) : null);
    } else {
      fields.push(`${key} = ?`);
      binds.push(value);
    }
  }
  if (fields.length === 0) return existing;

  const now = new Date().toISOString();
  fields.push("updated_at = ?");
  binds.push(now);
  binds.push(id);

  await db.prepare(`UPDATE contacts SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`)
    .bind(...binds)
    .run();

  return getContact(db, id);
}

export async function softDeleteContact(db: D1, id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const res = await db
    .prepare("UPDATE contacts SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
    .bind(now, now, id)
    .run();
  return res.meta.changes > 0;
}

