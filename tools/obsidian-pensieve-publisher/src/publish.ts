import { TFile, Notice, parseYaml, stringifyYaml, normalizePath } from "obsidian";
import { markdownToPortableText } from "./markdown-to-portable-text";
import { markdownToPlainText, extractImages, type ExtractedImage } from "./markdown-to-plain";
import { PensieveClient, FacebookClient, type PensieveCreateInput } from "./api";
import type PensievePublisherPlugin from "../main";

interface NoteFrontmatter {
	title?: string;
	slug?: string;
	language?: "vi" | "en";
	original_language?: "vi" | "en";
	excerpt?: string;
	category?: string;
	tags?: string[];
	status?: "published" | "draft";
	pensieve_id?: string;
	pensieve_url?: string;
}

export async function publishCurrentNote(
	plugin: PensievePublisherPlugin,
	opts: { crossPostFacebook: boolean },
): Promise<void> {
	const s = plugin.settings;
	if (!s.baseUrl || !s.apiToken) {
		new Notice("Pensieve Publisher: set Site URL and API token in settings first.");
		return;
	}

	const file = plugin.app.workspace.getActiveFile();
	if (!file) {
		new Notice("No active note to publish.");
		return;
	}
	if (file.extension !== "md") {
		new Notice("Only markdown notes can be published.");
		return;
	}

	const raw = await plugin.app.vault.read(file);
	const { frontmatter, body } = splitFrontmatter(raw);

	const title = frontmatter.title?.trim() || file.basename;
	const language = frontmatter.language || s.defaultLanguage;
	const status = frontmatter.status || s.defaultStatus;
	const blocks = markdownToPortableText(body);

	const input: PensieveCreateInput = {
		title,
		slug: frontmatter.slug,
		excerpt: frontmatter.excerpt,
		content: blocks,
		language,
		originalLanguage: frontmatter.original_language,
		status,
	};

	const client = new PensieveClient(s.baseUrl, s.apiToken);

	let entry;
	try {
		if (frontmatter.pensieve_id) {
			new Notice(`Updating post ${frontmatter.pensieve_id}…`);
			entry = await client.updatePost(frontmatter.pensieve_id, input);
		} else {
			new Notice(`Publishing "${title}"…`);
			entry = await client.createPost(input);
		}
	} catch (err) {
		new Notice(`Publish failed: ${(err as Error).message}`, 8000);
		console.error("[Pensieve Publisher] publish failed", err);
		return;
	}

	const categorySlug = frontmatter.category || s.defaultCategory;
	try {
		if (categorySlug) await client.setTaxonomy(entry.id, "category", [categorySlug]);
		if (frontmatter.tags && frontmatter.tags.length > 0) {
			await client.setTaxonomy(entry.id, "tag", frontmatter.tags);
		}
	} catch (err) {
		new Notice(`Taxonomy assignment failed (post still published): ${(err as Error).message}`, 6000);
	}

	await writeBackIds(plugin, file, raw, entry.id, entry.url);
	new Notice(`Published: ${entry.url}`, 6000);

	if (opts.crossPostFacebook && s.facebookPageId && s.facebookAccessToken) {
		await crossPostToFacebook(plugin, file, body, title, entry.url);
	}
}

/**
 * Publish the full note body (plain text + images) to Facebook as a native
 * photo post. Images referenced in the note are either uploaded directly
 * (local files) or sent by URL (remote). Zero images degrades gracefully
 * to a text-only post with a trailing link to the Pensieve post for context.
 */
async function crossPostToFacebook(
	plugin: PensievePublisherPlugin,
	file: TFile,
	body: string,
	title: string,
	pensieveUrl: string,
): Promise<void> {
	const s = plugin.settings;
	const fb = new FacebookClient(s.facebookPageId, s.facebookAccessToken);

	// Build the text body. Title → two line breaks → plain body → read-more link.
	// Keeping the Pensieve URL as a trailing line gives readers a path to the
	// canonical version (with styled typography, images at full res, comments).
	const plainBody = markdownToPlainText(body);
	const readMore = `→ ${pensieveUrl}`;
	const message = `${title}\n\n${plainBody}\n\n${readMore}`.trim();

	const imageRefs = extractImages(body);
	if (imageRefs.length === 0) {
		try {
			const res = await fb.postWithPhotos({ message, mediaFbids: [] });
			new Notice(`Facebook: posted ${res.id} (text only)`, 6000);
		} catch (err) {
			new Notice(`Facebook cross-post failed: ${(err as Error).message}`, 8000);
			console.error("[Pensieve Publisher] fb post failed", err);
		}
		return;
	}

	new Notice(`Uploading ${imageRefs.length} image(s) to Facebook…`);
	const mediaFbids: string[] = [];
	for (const img of imageRefs) {
		try {
			if (img.kind === "remote") {
				mediaFbids.push(await fb.uploadPhotoFromUrl(img.ref));
			} else {
				const bytes = await readLocalImage(plugin, file, img.ref);
				if (!bytes) {
					console.warn("[Pensieve Publisher] could not resolve local image:", img.ref);
					continue;
				}
				const filename = extractFilename(img.ref);
				mediaFbids.push(await fb.uploadPhotoFromBytes(bytes, filename));
			}
		} catch (err) {
			// Log but continue — one bad image shouldn't drop the whole post
			console.warn("[Pensieve Publisher] image upload failed for", img.ref, err);
		}
	}

	if (mediaFbids.length === 0) {
		new Notice(
			`Facebook: no images could be uploaded. Posting text only.`,
			6000,
		);
	}

	try {
		const res = await fb.postWithPhotos({ message, mediaFbids });
		new Notice(
			`Facebook: posted ${res.id} with ${mediaFbids.length} image(s)`,
			6000,
		);
	} catch (err) {
		new Notice(`Facebook cross-post failed: ${(err as Error).message}`, 8000);
		console.error("[Pensieve Publisher] fb post failed", err);
	}
}

/**
 * Resolve a local image reference to raw bytes. Handles both Obsidian
 * wiki-links (bare filename or with subpath) and markdown-image paths
 * (relative to the note or absolute within the vault).
 */
async function readLocalImage(
	plugin: PensievePublisherPlugin,
	noteFile: TFile,
	ref: string,
): Promise<ArrayBuffer | null> {
	const vault = plugin.app.vault;

	// First try the metadata cache to resolve wiki-link-style references
	const linkDest = plugin.app.metadataCache.getFirstLinkpathDest(ref, noteFile.path);
	if (linkDest) {
		return await vault.adapter.readBinary(linkDest.path);
	}

	// Fall back: try the path as-is, then relative to the note's folder
	const candidates = [
		ref,
		normalizePath(`${noteFile.parent?.path ?? ""}/${ref}`),
	];
	for (const candidate of candidates) {
		try {
			if (await vault.adapter.exists(candidate)) {
				return await vault.adapter.readBinary(candidate);
			}
		} catch {
			// try next candidate
		}
	}
	return null;
}

function extractFilename(ref: string): string {
	const stripped = ref.split("/").pop() || ref;
	return stripped.split("#")[0].split("?")[0];
}

function splitFrontmatter(raw: string): { frontmatter: NoteFrontmatter; body: string } {
	const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
	if (!match) return { frontmatter: {}, body: raw };
	let fm: NoteFrontmatter = {};
	try {
		fm = (parseYaml(match[1]) || {}) as NoteFrontmatter;
	} catch {
		// Malformed YAML — fall back to empty frontmatter, leave body intact
	}
	return { frontmatter: fm, body: raw.slice(match[0].length) };
}

async function writeBackIds(
	plugin: PensievePublisherPlugin,
	file: TFile,
	originalRaw: string,
	id: string,
	url: string,
): Promise<void> {
	const { frontmatter, body } = splitFrontmatter(originalRaw);
	const updated: NoteFrontmatter = { ...frontmatter, pensieve_id: id, pensieve_url: url };
	const yaml = stringifyYaml(updated).trimEnd();
	const next = `---\n${yaml}\n---\n${body.startsWith("\n") ? body : "\n" + body}`;
	if (next !== originalRaw) {
		await plugin.app.vault.modify(file, next);
	}
}
