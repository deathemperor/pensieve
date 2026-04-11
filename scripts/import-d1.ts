#!/usr/bin/env bun
/**
 * scripts/import-d1.ts
 *
 * Fold classified narratives into seed/seed.json so they become real content
 * the next time `emdash seed seed/seed.json` runs. This script is idempotent
 * and deliberately stays out of the database — the shell recipe at the
 * bottom of this file handles applying the seed to local + remote D1.
 *
 * Input files:
 *   data/long-posts.json      — ingest output (IngestedPost[])
 *   data/classified.json      — classifier output ({posts: Classification[]})
 *   seed/seed.json            — EmDash seed, will be updated in place
 *
 * What it does:
 *   1. Merges post text + classification metadata by id
 *   2. Dedupes pairs the classifier flagged as near-duplicates (same title)
 *      keeping the longest-text variant
 *   3. Converts raw post text into Portable Text blocks (paragraph splits)
 *   4. Generates ASCII slugs (with diacritic stripping) from Loc's titles
 *   5. Replaces seed.json `content.posts` with the new real entries
 *
 * Shell recipe to push to remote D1:
 *   bun run scripts/import-d1.ts
 *   rm -f data.db data.db-shm data.db-wal
 *   ./node_modules/.bin/emdash seed seed/seed.json
 *   sqlite3 data.db .dump > /tmp/pensieve-dump.sql
 *   # [see scripts/apply-to-remote.sh for the cleanup recipe]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// ----- types -----

interface Attachment {
	originalUri: string;
	description?: string;
}

interface IngestedPost {
	id: string;
	timestamp: number;
	date: string;
	text: string;
	charCount: number;
	wordCount: number;
	sentenceCount: number;
	language: "vi" | "en" | "mixed";
	title: string | null;
	attachments: Attachment[];
	sources: Array<"main" | "edits">;
}

interface Classification {
	id: string;
	category: string;
	title: string;
	excerpt: string;
	tags: string[];
	language: "vi" | "en" | "mixed";
	reasoning: string;
	confidence: "high" | "medium" | "low";
	suggested_new_category: string | null;
}

interface ClassifiedFile {
	generatedAt: string;
	tasteProfileUsed: boolean;
	count: number;
	posts: Classification[];
}

interface PortableTextSpan {
	_type: "span";
	text: string;
}

interface PortableTextBlock {
	_type: "block";
	style: "normal" | "h2" | "h3" | "blockquote";
	children: PortableTextSpan[];
	markDefs: [];
}

// ----- helpers -----

const VN_TO_ASCII: Array<[RegExp, string]> = [
	[/[àáảãạăắằẳẵặâấầẩẫậ]/g, "a"],
	[/[ÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ]/g, "A"],
	[/[èéẻẽẹêếềểễệ]/g, "e"],
	[/[ÈÉẺẼẸÊẾỀỂỄỆ]/g, "E"],
	[/[ìíỉĩị]/g, "i"],
	[/[ÌÍỈĨỊ]/g, "I"],
	[/[òóỏõọôốồổỗộơớờởỡợ]/g, "o"],
	[/[ÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢ]/g, "O"],
	[/[ùúủũụưứừửữự]/g, "u"],
	[/[ÙÚỦŨỤƯỨỪỬỮỰ]/g, "U"],
	[/[ỳýỷỹỵ]/g, "y"],
	[/[ỲÝỶỸỴ]/g, "Y"],
	[/đ/g, "d"],
	[/Đ/g, "D"],
];

function stripDiacritics(str: string): string {
	let out = str;
	for (const [re, replacement] of VN_TO_ASCII) {
		out = out.replace(re, replacement);
	}
	return out;
}

function slugify(title: string): string {
	const ascii = stripDiacritics(title);
	return (
		ascii
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "") // drop punctuation
			.trim()
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.slice(0, 80) || "untitled"
	);
}

/**
 * Convert raw post text into Portable Text blocks. Paragraphs split on blank
 * lines OR on " | " sequences (Facebook edit history uses pipe-separated
 * runs). Single newlines inside a paragraph become soft breaks within the
 * same span (Portable Text doesn't have a dedicated line break block in
 * EmDash's default schema, so we preserve them as text).
 */
function textToPortableText(text: string): PortableTextBlock[] {
	// Normalize: treat " | " as paragraph breaks (FB edit history artifact)
	const normalized = text.replace(/\s*\|\s*\|\s*/g, "\n\n").replace(/\s*\|\s*/g, "\n\n");
	const paragraphs = normalized
		.split(/\n{2,}/)
		.map((p) => p.trim())
		.filter(Boolean);

	return paragraphs.map((p) => ({
		_type: "block" as const,
		style: "normal" as const,
		children: [{ _type: "span" as const, text: p }],
		markDefs: [],
	}));
}

function stableEntryId(slug: string, timestamp: number): string {
	return createHash("sha1")
		.update(`${slug}|${timestamp}`)
		.digest("hex")
		.slice(0, 16);
}

// ----- main -----

function main() {
	const root = "/Users/deathemperor/death/pensieve";
	const longPosts: IngestedPost[] = JSON.parse(
		readFileSync(`${root}/data/long-posts.json`, "utf8"),
	);
	const classifiedFile: ClassifiedFile = JSON.parse(
		readFileSync(`${root}/data/classified.json`, "utf8"),
	);
	const seed = JSON.parse(readFileSync(`${root}/seed/seed.json`, "utf8"));

	const postsById = new Map(longPosts.map((p) => [p.id, p]));

	// ---- merge: classification + original text ----
	const merged: Array<{
		classification: Classification;
		post: IngestedPost;
	}> = [];

	for (const c of classifiedFile.posts) {
		const post = postsById.get(c.id);
		if (!post) {
			console.warn(`⚠️  Classified post ${c.id} not found in long-posts.json`);
			continue;
		}
		merged.push({ classification: c, post });
	}

	// ---- dedupe by (category, slugified title) — the classifier sometimes
	//       sees two near-identical variants and tags them the same way ----
	const bySlug = new Map<
		string,
		{ classification: Classification; post: IngestedPost }
	>();
	let dedupeCollisions = 0;

	for (const m of merged) {
		const slug = slugify(m.classification.title);
		const key = `${m.classification.category}::${slug}`;
		const existing = bySlug.get(key);
		if (!existing) {
			bySlug.set(key, m);
			continue;
		}
		dedupeCollisions++;
		// Keep the longer-text variant
		if (m.post.charCount > existing.post.charCount) {
			bySlug.set(key, m);
		}
	}

	const finalPosts = Array.from(bySlug.values()).sort(
		(a, b) => b.post.timestamp - a.post.timestamp,
	);

	console.log(`📚 Merged: ${merged.length} classified posts`);
	console.log(`🔀 Deduped collisions: ${dedupeCollisions}`);
	console.log(`✅ Final unique posts: ${finalPosts.length}`);

	// ---- build seed.json content.posts entries ----
	const seedPosts = finalPosts.map(({ classification, post }) => {
		const slug = slugify(classification.title);
		const id = stableEntryId(slug, post.timestamp);

		// Normalize tags: lowercase-hyphenated, <=24 chars
		const tags = (classification.tags || [])
			.map((t) =>
				stripDiacritics(t)
					.toLowerCase()
					.replace(/[^a-z0-9\s-]/g, "")
					.trim()
					.replace(/\s+/g, "-")
					.slice(0, 24),
			)
			.filter(Boolean);

		return {
			id,
			slug,
			status: "published" as const,
			data: {
				title: classification.title,
				excerpt: classification.excerpt,
				content: textToPortableText(post.text),
				language: post.language,
				source: "facebook",
				source_id: post.id,
			},
			bylines: [{ byline: "byline-main" }],
			taxonomies: {
				category: [classification.category],
				tag: tags,
			},
		};
	});

	// ---- merge new tag terms into seed.json taxonomies ----
	const allTags = new Set<string>();
	for (const p of seedPosts) {
		for (const t of p.taxonomies.tag) allTags.add(t);
	}

	const tagTaxonomy = seed.taxonomies.find(
		(t: { name: string }) => t.name === "tag",
	);
	if (tagTaxonomy) {
		const existingTagSlugs = new Set(
			tagTaxonomy.terms.map((t: { slug: string }) => t.slug),
		);
		for (const slug of allTags) {
			if (!existingTagSlugs.has(slug)) {
				tagTaxonomy.terms.push({
					slug,
					label: slug
						.replace(/-/g, " ")
						.replace(/\b\w/g, (c: string) => c.toUpperCase()),
				});
			}
		}
	}

	// ---- replace seed.json content.posts ----
	seed.content.posts = seedPosts;

	writeFileSync(`${root}/seed/seed.json`, JSON.stringify(seed, null, "\t"));

	console.log("");
	console.log("✨ Updated seed/seed.json");
	console.log(`   - content.posts: ${seedPosts.length}`);
	console.log(`   - new tag terms added: ${allTags.size}`);
	console.log("");
	console.log("📋 Category breakdown:");
	const byCat: Record<string, number> = {};
	for (const p of seedPosts) {
		const cat = p.taxonomies.category[0];
		byCat[cat] = (byCat[cat] || 0) + 1;
	}
	for (const [cat, n] of Object.entries(byCat).sort(
		(a, b) => b[1] - a[1],
	)) {
		console.log(`   ${cat}: ${n}`);
	}
	console.log("");
	console.log("🪓 Next steps (run manually):");
	console.log("");
	console.log("   # Wipe local DB and re-seed with real content");
	console.log(
		"   rm -f data.db data.db-shm data.db-wal && ./node_modules/.bin/emdash seed seed/seed.json",
	);
	console.log("");
	console.log("   # Dump local and push to remote D1");
	console.log(
		"   sqlite3 data.db .dump > /tmp/pensieve-content.sql && bash scripts/apply-to-remote.sh",
	);
	console.log("");
	console.log("   # Deploy (if wrangler config or code changed)");
	console.log("   ./node_modules/.bin/wrangler deploy");
}

main();
