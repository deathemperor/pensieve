import { TFile, Notice, parseYaml, stringifyYaml } from "obsidian";
import { markdownToPortableText } from "./markdown-to-portable-text";
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
		if (categorySlug) {
			await client.setTaxonomy(entry.id, "category", [categorySlug]);
		}
		if (frontmatter.tags && frontmatter.tags.length > 0) {
			await client.setTaxonomy(entry.id, "tag", frontmatter.tags);
		}
	} catch (err) {
		new Notice(`Taxonomy assignment failed (post still published): ${(err as Error).message}`, 6000);
	}

	await writeBackIds(plugin, file, raw, entry.id, entry.url);
	new Notice(`Published: ${entry.url}`, 6000);

	if (opts.crossPostFacebook && s.facebookPageId && s.facebookAccessToken) {
		try {
			const fb = new FacebookClient(s.facebookPageId, s.facebookAccessToken);
			const message = frontmatter.excerpt || title;
			const result = await fb.postLink({ url: entry.url, message });
			new Notice(`Facebook: posted ${result.id}`, 6000);
		} catch (err) {
			new Notice(`Facebook cross-post failed: ${(err as Error).message}`, 8000);
			console.error("[Pensieve Publisher] fb post failed", err);
		}
	}
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
