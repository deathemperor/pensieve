#!/usr/bin/env bun
/**
 * scripts/import-d1.ts
 *
 * Fold classified + translated narratives into seed/seed.json so the next
 * `emdash seed seed/seed.json` run creates the full bilingual content set.
 *
 * For each classified post we emit TWO content entries: one in Vietnamese
 * and one in English, linked by a shared `source_id` and carrying an
 * `original_language` marker so the post page can show a "Originally written
 * in X" citation banner on the translated variant.
 *
 * Inputs:
 *   data/long-posts.json          — ingest output (IngestedPost[])
 *   data/classified.json          — classifier output ({posts: Classification[]})
 *   data/translations-batch-{1..5}.json  — bilingual translations per post
 *   seed/seed.json                — EmDash seed, updated in place
 *
 * Shell recipe to push after running this:
 *   bun run scripts/import-d1.ts
 *   rm -f data.db data.db-shm data.db-wal
 *   ./node_modules/.bin/emdash seed seed/seed.json
 *   bash scripts/apply-to-remote.sh
 *   ./node_modules/.bin/wrangler deploy
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
	corpusVersion?: string;
	count: number;
	posts: Classification[];
}

interface Translation {
	id: string;
	originalLanguage: "vi" | "en" | "mixed";
	title_vi: string;
	title_en: string;
	excerpt_vi: string;
	excerpt_en: string;
	content_vi: string;
	content_en: string;
}

interface TranslationBatch {
	batch: number;
	startIndex: number;
	endIndex: number;
	count: number;
	posts: Translation[];
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
			.replace(/[^a-z0-9\s-]/g, "")
			.trim()
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.slice(0, 80) || "untitled"
	);
}

function textToPortableText(text: string): PortableTextBlock[] {
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

function stableEntryId(slug: string, lang: string): string {
	return createHash("sha1")
		.update(`${slug}|${lang}`)
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

	// Load all translation batches
	const translationMap = new Map<string, Translation>();
	for (let i = 1; i <= 5; i++) {
		const path = `${root}/data/translations-batch-${i}.json`;
		if (!existsSync(path)) {
			console.warn(`⚠️  Missing translation batch ${i} at ${path}`);
			continue;
		}
		const batch: TranslationBatch = JSON.parse(readFileSync(path, "utf8"));
		for (const t of batch.posts) {
			translationMap.set(t.id, t);
		}
	}

	const postsById = new Map(longPosts.map((p) => [p.id, p]));

	// Merge: classification + original text + translation
	interface Merged {
		classification: Classification;
		post: IngestedPost;
		translation: Translation;
	}
	const merged: Merged[] = [];
	const missing: string[] = [];

	for (const c of classifiedFile.posts) {
		const post = postsById.get(c.id);
		const translation = translationMap.get(c.id);
		if (!post) {
			missing.push(`post-missing:${c.id}`);
			continue;
		}
		if (!translation) {
			missing.push(`translation-missing:${c.id}`);
			continue;
		}
		merged.push({ classification: c, post, translation });
	}

	if (missing.length > 0) {
		console.warn(`⚠️  ${missing.length} posts dropped due to missing data:`);
		missing.slice(0, 10).forEach((m) => console.warn(`   ${m}`));
	}

	console.log(`📚 Classified: ${classifiedFile.posts.length}`);
	console.log(`🌐 Translated: ${translationMap.size}`);
	console.log(`✅ Merged: ${merged.length}`);

	// Build bilingual seed.content.posts
	interface SeedPost {
		id: string;
		slug: string;
		status: "published";
		data: {
			title: string;
			excerpt: string;
			content: PortableTextBlock[];
			language: "vi" | "en";
			original_language: "vi" | "en" | "mixed";
			source: "facebook";
			source_id: string;
		};
		bylines: Array<{ byline: string }>;
		taxonomies: { category: string[]; tag: string[] };
	}

	const seedPosts: SeedPost[] = [];
	const usedSlugs = new Set<string>();

	function uniqueSlug(base: string): string {
		let s = base;
		let n = 1;
		while (usedSlugs.has(s)) {
			s = `${base}-${n}`;
			n++;
		}
		usedSlugs.add(s);
		return s;
	}

	// Sort by timestamp descending so the newest posts are first
	merged.sort((a, b) => b.post.timestamp - a.post.timestamp);

	for (const m of merged) {
		const tags = (m.classification.tags || [])
			.map((t) =>
				stripDiacritics(t)
					.toLowerCase()
					.replace(/[^a-z0-9\s-]/g, "")
					.trim()
					.replace(/\s+/g, "-")
					.slice(0, 24),
			)
			.filter(Boolean);

		const origLang = m.translation.originalLanguage;

		// Vietnamese variant
		const slugVi = uniqueSlug(slugify(m.translation.title_vi));
		seedPosts.push({
			id: stableEntryId(slugVi, "vi"),
			slug: slugVi,
			status: "published",
			data: {
				title: m.translation.title_vi,
				excerpt: m.translation.excerpt_vi,
				content: textToPortableText(m.translation.content_vi),
				language: "vi",
				original_language: origLang,
				source: "facebook",
				source_id: m.post.id,
			},
			bylines: [{ byline: "byline-main" }],
			taxonomies: {
				category: [m.classification.category],
				tag: tags,
			},
		});

		// English variant
		const slugEn = uniqueSlug(slugify(m.translation.title_en));
		seedPosts.push({
			id: stableEntryId(slugEn, "en"),
			slug: slugEn,
			status: "published",
			data: {
				title: m.translation.title_en,
				excerpt: m.translation.excerpt_en,
				content: textToPortableText(m.translation.content_en),
				language: "en",
				original_language: origLang,
				source: "facebook",
				source_id: m.post.id,
			},
			bylines: [{ byline: "byline-main" }],
			taxonomies: {
				category: [m.classification.category],
				tag: tags,
			},
		});
	}

	// Collect and register tag terms
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

	// Replace seed.content.posts
	seed.content.posts = seedPosts;

	writeFileSync(`${root}/seed/seed.json`, JSON.stringify(seed, null, "\t"));

	// ---- summary ----
	const byCat: Record<string, number> = {};
	const byLang: Record<string, number> = { vi: 0, en: 0 };
	for (const p of seedPosts) {
		const cat = p.taxonomies.category[0];
		byCat[cat] = (byCat[cat] || 0) + 1;
		byLang[p.data.language]++;
	}

	console.log("");
	console.log("✨ Updated seed/seed.json");
	console.log(`   - content.posts: ${seedPosts.length} (${merged.length} × 2 languages)`);
	console.log(`   - new tag terms added: ${allTags.size}`);
	console.log("");
	console.log("🗣️  Language breakdown:");
	console.log(`   vi: ${byLang.vi}`);
	console.log(`   en: ${byLang.en}`);
	console.log("");
	console.log("📋 Category breakdown (per language, ×2 total):");
	for (const [cat, n] of Object.entries(byCat).sort(
		(a, b) => b[1] - a[1],
	)) {
		console.log(`   ${cat}: ${n}`);
	}
	console.log("");
	console.log("🪓 Next steps:");
	console.log("   rm -f data.db data.db-shm data.db-wal");
	console.log("   ./node_modules/.bin/emdash seed seed/seed.json");
	console.log("   bash scripts/apply-to-remote.sh");
	console.log("   ./node_modules/.bin/wrangler deploy");
}

main();
