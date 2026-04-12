#!/usr/bin/env bun
/**
 * scripts/fix-dates.ts
 *
 * EmDash's seed loader hardcodes `published_at = new Date()` when a post has
 * `status: "published"` — it ignores any `publishedAt` field in seed entries.
 * This script post-processes the local data.db to set published_at from the
 * seed.json publishedAt values (which come from the original Facebook post
 * timestamps via import-d1.ts).
 *
 * Run order:
 *   rm -f data.db data.db-shm data.db-wal
 *   ./node_modules/.bin/emdash seed seed/seed.json
 *   bun run scripts/fix-dates.ts            <-- this script
 *   bash scripts/apply-to-remote.sh
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const seed = JSON.parse(readFileSync("seed/seed.json", "utf8"));
const posts: Array<{ slug: string; publishedAt?: string }> = seed.content?.posts ?? [];

const updates: string[] = [];
for (const p of posts) {
	if (!p.publishedAt) continue;
	const slug = p.slug.replace(/'/g, "''");
	updates.push(
		`UPDATE ec_posts SET published_at = '${p.publishedAt}', created_at = '${p.publishedAt}' WHERE slug = '${slug}';`,
	);
}

const sqlPath = "/tmp/pensieve-fix-dates.sql";
writeFileSync(sqlPath, updates.join("\n"));
console.log(`📝 Wrote ${updates.length} UPDATE statements to ${sqlPath}`);

execSync(`sqlite3 data.db < ${sqlPath}`, { stdio: "inherit" });
console.log(`✔ Applied to local data.db`);
