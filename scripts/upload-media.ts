#!/usr/bin/env bun
/**
 * scripts/upload-media.ts
 *
 * Walks the Facebook DYI zip, extracts the first image attachment per post,
 * uploads it to Cloudflare R2 under media/{sha256}.{ext}, and writes a
 * manifest at data/media-map.json that import-d1.ts reads to populate each
 * post's featured_image field.
 *
 * Why not use EmDash's seed $media URL download feature?
 *   - It expects http(s) URLs, not local file paths.
 *   - Running a local HTTP server during seed is fragile.
 *   - We bypass EmDash's media table entirely and serve R2 via a Worker
 *     proxy route (/pensieve/m/<hash>) registered in src/worker.ts.
 *
 * Usage:
 *   bun run scripts/upload-media.ts
 *
 * The script is idempotent: if media-map.json already has an entry for a
 * post and the R2 object exists, it's skipped. This makes re-runs cheap.
 */

import {
	existsSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	readdirSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import AdmZip from "adm-zip";

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
	attachments: Attachment[];
	title: string | null;
	language: string;
}

interface MediaEntry {
	key: string; // SHA256 + extension, e.g. "a1b2c3...jpg"
	filename: string; // original filename from the zip
	mimeType: string;
	size: number;
	description?: string;
}

interface MediaMap {
	[postId: string]: MediaEntry;
}

// ----- helpers -----

function sha256(buf: Buffer): string {
	return createHash("sha256").update(buf).digest("hex");
}

function extOf(uri: string): string {
	const m = uri.match(/\.(jpe?g|png|webp|gif)$/i);
	return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "";
}

function mimeOf(ext: string): string {
	switch (ext) {
		case "jpg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "webp":
			return "image/webp";
		case "gif":
			return "image/gif";
		default:
			return "application/octet-stream";
	}
}

// ----- main -----

function findZip(): string {
	const dir = "data";
	const matches = readdirSync(dir).filter((f) => /^facebook-.*\.zip$/.test(f));
	if (matches.length === 0) {
		throw new Error("No facebook-*.zip found in data/");
	}
	return join(dir, matches[0]);
}

async function main() {
	const zipPath = findZip();
	console.log(`📦 Reading ${zipPath}`);
	const zip = new AdmZip(zipPath);

	const longPosts: IngestedPost[] = JSON.parse(
		readFileSync("data/long-posts.json", "utf8"),
	);
	console.log(`📄 Loaded ${longPosts.length} posts`);

	// Load existing map if any (idempotent re-runs)
	const mapPath = "data/media-map.json";
	let existing: MediaMap = {};
	if (existsSync(mapPath)) {
		existing = JSON.parse(readFileSync(mapPath, "utf8"));
		console.log(`🔁 Resuming from ${Object.keys(existing).length} existing entries`);
	}

	const stagingDir = "/tmp/pensieve-media-staging";
	mkdirSync(stagingDir, { recursive: true });

	const newMap: MediaMap = { ...existing };
	const byHash = new Map<string, MediaEntry>();
	// Pre-populate byHash from existing entries so we dedupe across runs
	for (const entry of Object.values(existing)) {
		byHash.set(entry.key, entry);
	}

	const toUpload: Array<{ localPath: string; remoteKey: string }> = [];
	let skippedNoImage = 0;
	let skippedVideo = 0;
	let scanned = 0;

	for (const post of longPosts) {
		scanned++;
		if (!post.attachments || post.attachments.length === 0) {
			skippedNoImage++;
			continue;
		}
		// Find the first IMAGE attachment (skip mp4/video)
		const firstImage = post.attachments.find((a) => extOf(a.originalUri));
		if (!firstImage) {
			skippedVideo++;
			continue;
		}
		// Skip if we already have this post mapped
		if (newMap[post.id]) continue;

		// Extract from zip
		const entry = zip.getEntry(firstImage.originalUri);
		if (!entry) {
			console.warn(`⚠️  Zip missing entry: ${firstImage.originalUri}`);
			continue;
		}
		const buf = entry.getData();
		const ext = extOf(firstImage.originalUri);
		const hash = sha256(buf);
		const key = `${hash}.${ext}`;
		const filename = firstImage.originalUri.split("/").pop() || key;
		const mimeType = mimeOf(ext);

		// Dedupe: if we already uploaded this hash for another post, reuse
		const cached = byHash.get(key);
		if (cached) {
			newMap[post.id] = cached;
			continue;
		}

		// Stage to /tmp for wrangler upload
		const localPath = join(stagingDir, key);
		writeFileSync(localPath, buf);

		const mediaEntry: MediaEntry = {
			key,
			filename,
			mimeType,
			size: buf.length,
			description: firstImage.description,
		};
		newMap[post.id] = mediaEntry;
		byHash.set(key, mediaEntry);
		toUpload.push({ localPath, remoteKey: `media/${key}` });
	}

	console.log("");
	console.log(`📊 Scanned ${scanned} posts`);
	console.log(`   - no attachments:   ${skippedNoImage}`);
	console.log(`   - video only:       ${skippedVideo}`);
	console.log(`   - already mapped:   ${scanned - skippedNoImage - skippedVideo - toUpload.length - (Object.keys(newMap).length - Object.keys(existing).length - toUpload.length)}`);
	console.log(`   - ready to upload:  ${toUpload.length}`);
	console.log("");

	if (toUpload.length === 0) {
		console.log("✅ Nothing new to upload.");
	} else {
		console.log(`🚀 Uploading ${toUpload.length} files to R2 via wrangler...`);
		let uploaded = 0;
		for (const { localPath, remoteKey } of toUpload) {
			try {
				execSync(
					`./node_modules/.bin/wrangler r2 object put "pensieve-media/${remoteKey}" --file="${localPath}" --remote`,
					{ stdio: ["pipe", "pipe", "pipe"] },
				);
				uploaded++;
				if (uploaded % 10 === 0 || uploaded === toUpload.length) {
					console.log(`   ${uploaded}/${toUpload.length}`);
				}
			} catch (e) {
				console.warn(`⚠️  Upload failed for ${remoteKey}: ${(e as Error).message}`);
			}
		}
		console.log(`✅ Uploaded ${uploaded}/${toUpload.length} files`);
	}

	writeFileSync(mapPath, JSON.stringify(newMap, null, 2));
	console.log(`💾 Wrote ${mapPath} with ${Object.keys(newMap).length} entries`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
