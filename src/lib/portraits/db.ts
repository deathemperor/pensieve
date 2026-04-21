import type {
  Contact,
  ContactWithChannels,
  Channel,
  CreateContactInput,
  ListContactsOptions,
  TierCode,
} from "./types";

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

// 26-char Crockford-base32 ULID, monotonic within process.
// Kept inline to avoid a dependency; hot path is admin-only.
let _lastMs = 0;
let _lastRand: Uint8Array = new Uint8Array(10);
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulid(): string {
  const now = Date.now();
  let rand: Uint8Array;
  if (now === _lastMs) {
    // monotonic increment
    rand = new Uint8Array(_lastRand);
    for (let i = 9; i >= 0; i--) {
      rand[i] = (rand[i] + 1) & 0xff;
      if (rand[i] !== 0) break;
    }
  } else {
    rand = crypto.getRandomValues(new Uint8Array(10));
    _lastMs = now;
  }
  _lastRand = rand;

  let time = "";
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }

  let randStr = "";
  let bits = 0;
  let acc = 0;
  for (let i = 0; i < 10; i++) {
    acc = (acc << 8) | rand[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      randStr += CROCKFORD[(acc >> bits) & 31];
    }
  }
  return time + randStr;
}
