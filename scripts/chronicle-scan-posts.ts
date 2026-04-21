#!/usr/bin/env -S node --import tsx
/**
 * chronicle-scan-posts: scan published posts for date patterns and emit
 * draft Chronicle entry candidates (one JSON object per line on stdout).
 *
 * Usage:
 *   npx tsx scripts/chronicle-scan-posts.ts [--db ./data.db]
 *
 * The default database is ./data.db (local SQLite used by `bun run dev`).
 * The output is review-only — no rows are written. Pipe into less / jq or
 * into an editor to copy meaningful entries into seed/seed.json.
 */

import { execFileSync } from "node:child_process";
import { extractDatesFromPortableText } from "../src/utils/dateExtract.js";

interface PostRow {
	id: string;
	slug: string | null;
	title: string;
	content: string; // JSON string of Portable Text
}

interface PostCandidate {
	post_id: string;
	post_slug: string | null;
	post_title: string;
	iso_date: string;
	precision: "day" | "month" | "year";
	context: string;
	suggested_category: string;
	suggested_entry: {
		title: string;
		event_date: string;
		date_precision: "day" | "month" | "year";
		source: string;
		source_id: string | null;
		status: string;
	};
}

function parseArgs(argv: string[]): { dbPath: string } {
	let dbPath = "./data.db";
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--db" && argv[i + 1]) {
			dbPath = argv[i + 1];
			i++;
		}
	}
	return { dbPath };
}

function queryPublishedPosts(dbPath: string): PostRow[] {
	const out = execFileSync(
		"sqlite3",
		[
			"-readonly",
			dbPath,
			"-json",
			"SELECT id, slug, title, content FROM ec_posts WHERE status='published' AND deleted_at IS NULL",
		],
		{ encoding: "utf8" },
	);
	if (!out.trim()) return [];
	return JSON.parse(out) as PostRow[];
}

function parsePortableText(content: string): unknown {
	try {
		return JSON.parse(content);
	} catch {
		return [];
	}
}

function toCandidate(
	row: PostRow,
	match: { isoDate: string; precision: "day" | "month" | "year"; context: string },
): PostCandidate {
	const slugOrId = row.slug ?? row.id;
	return {
		post_id: row.id,
		post_slug: row.slug,
		post_title: row.title,
		iso_date: match.isoDate,
		precision: match.precision,
		context: match.context,
		suggested_category: "milestone",
		suggested_entry: {
			title: match.context.length <= 60 ? match.context : match.context.slice(0, 57) + "...",
			event_date: match.isoDate,
			date_precision: match.precision,
			source: "post-scan",
			source_id: slugOrId,
			status: "draft",
		},
	};
}

function main(argv: string[]): void {
	const { dbPath } = parseArgs(argv);
	const posts = queryPublishedPosts(dbPath);
	for (const row of posts) {
		const blocks = parsePortableText(row.content);
		const matches = extractDatesFromPortableText(blocks);
		for (const m of matches) {
			const candidate = toCandidate(row, m);
			process.stdout.write(JSON.stringify(candidate) + "\n");
		}
	}
}

main(process.argv.slice(2));
