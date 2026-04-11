#!/usr/bin/env bun
/**
 * scripts/ingest-facebook.ts
 *
 * Extract narrative posts from a Facebook DYI (Download Your Information) export,
 * fix the mojibake (UTF-8 double-encoded as Latin-1), filter for long-form
 * narratives, write data/long-posts.json.
 *
 * Handles both the main timeline file and the edits history file — the latter
 * often contains the *latest* version of a post that was edited multiple times.
 *
 * Run:
 *   bun run scripts/ingest-facebook.ts
 *   bun run scripts/ingest-facebook.ts --zip data/facebook-*.zip
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";

// ----- configuration -----

const MIN_CHARS = 500;
const MIN_SENTENCES = 3;
const MIN_WORDS = 80;

// Vietnamese-specific diacritics for language detection
const VN_DIACRITIC_RE =
	/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/;

// Sentence-ending punctuation (counts as narrative structure signal)
const SENTENCE_END_RE = /[.!?…。！？]+/g;

// ----- types -----

interface Attachment {
	originalUri: string;
	description?: string;
}

interface IngestedPost {
	id: string; // stable: sha1(timestamp + first 64 chars of text)
	timestamp: number;
	date: string; // ISO 8601
	text: string;
	charCount: number;
	wordCount: number;
	sentenceCount: number;
	language: "vi" | "en" | "mixed";
	title: string | null;
	attachments: Attachment[];
	sources: Array<"main" | "edits">;
}

// ----- helpers -----

/**
 * Facebook's DYI export has a well-known bug: UTF-8 text is encoded byte-by-byte
 * as Latin-1 (ISO-8859-1), then JSON-escaped with \uXXXX sequences for the
 * high bytes. After JSON.parse, each char is a single Latin-1 byte of the
 * original UTF-8 sequence. To recover, re-encode as Latin-1 bytes and decode
 * as UTF-8.
 */
function fixMojibake(str: string): string {
	if (!str) return str;
	try {
		return Buffer.from(str, "latin1").toString("utf8");
	} catch {
		return str;
	}
}

// Density-based language detection: Vietnamese text naturally contains
// 10-20% diacritic characters (tone marks + vowel modifiers). English text
// has none. A post with > 3% VN-unique chars is Vietnamese-dominant; < 0.5%
// is English; anything in between is genuinely mixed (e.g. Vietnamese
// narrative quoting English names or code snippets).
const VN_UNIQUE_RE =
	/[ăâđêôơưàáảãạằắẳẵặầấẩẫậềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵĂÂĐÊÔƠƯÀÁẢÃẠẰẮẲẴẶẦẤẨẪẬỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌỒỐỔỖỘỜỚỞỠỢÙÚỦŨỤỪỨỬỮỰỲÝỶỸỴ]/g;

function detectLanguage(text: string): "vi" | "en" | "mixed" {
	const totalLetters = (text.match(/\p{L}/gu) || []).length;
	if (totalLetters === 0) return "en";
	const vnChars = (text.match(VN_UNIQUE_RE) || []).length;
	const vnDensity = vnChars / totalLetters;

	if (vnDensity > 0.03) return "vi";
	if (vnDensity > 0.005) return "mixed";
	return "en";
}

function countSentences(text: string): number {
	const matches = text.match(SENTENCE_END_RE);
	return matches ? matches.length : 0;
}

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Normalize text for dedup key: lowercase, collapse whitespace, take first
 * 200 chars. This catches near-duplicates that differ only by a few edit-level
 * revisions (typo fix, whitespace, trailing punctuation).
 */
function dedupKey(text: string): string {
	const normalized = text
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200);
	return createHash("sha1").update(normalized).digest("hex").slice(0, 16);
}

function postId(timestamp: number, text: string): string {
	return createHash("sha1")
		.update(`${timestamp}|${text.slice(0, 64)}`)
		.digest("hex")
		.slice(0, 16);
}

// ----- DYI parsing -----

interface RawMainPost {
	timestamp: number;
	title?: string;
	data?: Array<{ post?: string }>;
	attachments?: Array<{
		data?: Array<{
			media?: { uri?: string; description?: string };
			text?: string;
			external_context?: { url?: string };
		}>;
	}>;
}

interface RawEditEntry {
	timestamp: number;
	fbid?: string;
	label_values?: Array<{ label?: string; value?: string }>;
	media?: Array<{ uri?: string; description?: string }>;
}

function extractTextFromMainPost(raw: RawMainPost): {
	text: string;
	attachments: Attachment[];
} {
	const textParts: string[] = [];
	for (const d of raw.data || []) {
		if (typeof d?.post === "string" && d.post.trim()) {
			textParts.push(fixMojibake(d.post));
		}
	}
	const attachments: Attachment[] = [];
	for (const a of raw.attachments || []) {
		for (const d of a?.data || []) {
			if (d?.media?.uri) {
				attachments.push({
					originalUri: d.media.uri,
					description: d.media.description
						? fixMojibake(d.media.description)
						: undefined,
				});
			}
		}
	}
	return { text: textParts.join("\n\n"), attachments };
}

function extractTextFromEdit(raw: RawEditEntry): {
	text: string;
	attachments: Attachment[];
} {
	const textParts: string[] = [];
	for (const lv of raw.label_values || []) {
		if (lv?.label === "Text" && typeof lv.value === "string") {
			textParts.push(fixMojibake(lv.value));
		}
	}
	const attachments: Attachment[] = [];
	for (const m of raw.media || []) {
		if (m?.uri) {
			attachments.push({
				originalUri: m.uri,
				description: m.description ? fixMojibake(m.description) : undefined,
			});
		}
	}
	return { text: textParts.join("\n\n"), attachments };
}

// ----- main pipeline -----

interface Args {
	zipPath: string;
	outputPath: string;
}

function parseArgs(): Args {
	const args = process.argv.slice(2);
	let zipPath = "";
	let outputPath = "data/long-posts.json";

	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--zip") zipPath = args[++i];
		else if (a === "--output" || a === "-o") outputPath = args[++i];
	}

	if (!zipPath) {
		// Glob data/facebook-*.zip
		const dataDir = "data";
		if (existsSync(dataDir)) {
			const { readdirSync } = require("node:fs");
			const matches = readdirSync(dataDir).filter(
				(f: string) => /^facebook-.*\.zip$/i.test(f),
			);
			if (matches.length > 0) {
				zipPath = join(dataDir, matches[0]);
			}
		}
	}

	if (!zipPath) {
		console.error(
			"❌ No zip file specified and none found via data/facebook-*.zip glob.",
		);
		console.error("   Usage: bun run scripts/ingest-facebook.ts --zip <path>");
		process.exit(1);
	}

	if (!existsSync(zipPath)) {
		console.error(`❌ Zip file does not exist: ${zipPath}`);
		process.exit(1);
	}

	return { zipPath, outputPath };
}

function main() {
	const args = parseArgs();
	console.log(`📦 Reading DYI zip: ${args.zipPath}`);

	const zip = new AdmZip(args.zipPath);
	const entries = zip.getEntries();

	const mainEntry = entries.find((e) =>
		/your_posts__check_ins__photos_and_videos_\d+\.json$/.test(e.entryName),
	);
	const editsEntry = entries.find((e) =>
		/edits_you_made_to_posts\.json$/.test(e.entryName),
	);

	if (!mainEntry) {
		console.error(
			"❌ Main timeline file not found (expected your_posts__check_ins__photos_and_videos_*.json).",
		);
		process.exit(1);
	}

	// ---- parse main posts ----
	const mainRaw: RawMainPost[] = JSON.parse(
		mainEntry.getData().toString("utf8"),
	);
	console.log(`📄 Main posts file: ${mainRaw.length} entries`);

	// ---- parse edits ----
	let editsRaw: RawEditEntry[] = [];
	if (editsEntry) {
		editsRaw = JSON.parse(editsEntry.getData().toString("utf8"));
		console.log(`📝 Edits file: ${editsRaw.length} entries`);
	}

	// ---- collect all candidates from both files ----
	interface Candidate extends IngestedPost {
		dedupKey: string;
	}
	const candidates: Candidate[] = [];

	const addCandidate = (
		raw: RawMainPost | RawEditEntry,
		text: string,
		attachments: Attachment[],
		source: "main" | "edits",
		title: string | null,
	) => {
		if (!text) return;
		const charCount = text.length;
		const sentenceCount = countSentences(text);
		const wordCount = countWords(text);
		if (charCount < MIN_CHARS) return;
		if (sentenceCount < MIN_SENTENCES) return;
		if (wordCount < MIN_WORDS) return;

		candidates.push({
			id: postId(raw.timestamp, text),
			dedupKey: dedupKey(text),
			timestamp: raw.timestamp,
			date: new Date(raw.timestamp * 1000).toISOString(),
			text,
			charCount,
			wordCount,
			sentenceCount,
			language: detectLanguage(text),
			title,
			attachments,
			sources: [source],
		});
	};

	for (const raw of mainRaw) {
		const { text, attachments } = extractTextFromMainPost(raw);
		addCandidate(
			raw,
			text,
			attachments,
			"main",
			raw.title ? fixMojibake(raw.title) : null,
		);
	}

	for (const raw of editsRaw) {
		const { text, attachments } = extractTextFromEdit(raw);
		addCandidate(raw, text, attachments, "edits", null);
	}

	// ---- dedupe: group by normalized text prefix, keep the longest version
	// from the latest timestamp (the "final" edit of a post) ----
	const byDedup = new Map<string, Candidate>();
	for (const c of candidates) {
		const existing = byDedup.get(c.dedupKey);
		if (!existing) {
			byDedup.set(c.dedupKey, c);
			continue;
		}
		// Merge sources
		for (const s of c.sources) {
			if (!existing.sources.includes(s)) existing.sources.push(s);
		}
		// Prefer longer text at later timestamp
		if (
			c.charCount > existing.charCount ||
			(c.charCount === existing.charCount && c.timestamp > existing.timestamp)
		) {
			existing.text = c.text;
			existing.charCount = c.charCount;
			existing.wordCount = c.wordCount;
			existing.sentenceCount = c.sentenceCount;
			existing.language = c.language;
			existing.timestamp = c.timestamp;
			existing.date = c.date;
			existing.id = c.id;
			// union attachments by originalUri
			const seenUris = new Set(existing.attachments.map((a) => a.originalUri));
			for (const a of c.attachments) {
				if (!seenUris.has(a.originalUri)) existing.attachments.push(a);
			}
		}
	}
	const byKey = new Map<string, IngestedPost>();
	for (const c of byDedup.values()) {
		// Drop the dedupKey field from the final output
		const { dedupKey: _, ...rest } = c;
		byKey.set(rest.id, rest);
	}

	const posts = Array.from(byKey.values()).sort(
		(a, b) => b.timestamp - a.timestamp,
	);

	// ---- summary stats ----
	const byLang = { vi: 0, en: 0, mixed: 0 };
	let totalChars = 0;
	for (const p of posts) {
		byLang[p.language]++;
		totalChars += p.charCount;
	}

	console.log("");
	console.log("✨ Narrative extraction summary:");
	console.log(`   Total narratives kept: ${posts.length}`);
	console.log(
		`   Language breakdown: vi=${byLang.vi}  en=${byLang.en}  mixed=${byLang.mixed}`,
	);
	console.log(`   Total characters: ${totalChars}`);
	console.log(
		`   Avg length: ${Math.round(totalChars / Math.max(1, posts.length))} chars`,
	);
	if (posts.length > 0) {
		console.log("");
		console.log("📚 First 3 narratives (decoded):");
		for (const p of posts.slice(0, 3)) {
			console.log("");
			console.log(
				`   [${p.date.slice(0, 10)}] ${p.language} | ${p.charCount} chars | ${p.sentenceCount} sentences`,
			);
			console.log(`   ${p.text.slice(0, 180).replace(/\n/g, " ⏎ ")}...`);
		}
	}

	// ---- write output ----
	mkdirSync(dirname(args.outputPath), { recursive: true });
	writeFileSync(args.outputPath, JSON.stringify(posts, null, 2));
	console.log("");
	console.log(`💾 Wrote ${args.outputPath}`);
}

main();
