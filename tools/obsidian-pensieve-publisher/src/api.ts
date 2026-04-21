import { requestUrl, type RequestUrlResponse } from "obsidian";

// EmDash + Facebook clients used by the publish flow. Obsidian's requestUrl
// bypasses the browser CORS guard so we can talk to the site's admin API
// directly from the plugin.

export type PensieveCreateInput = {
	title: string;
	slug?: string;
	excerpt?: string;
	content: unknown[]; // Portable Text blocks
	language: "vi" | "en";
	originalLanguage?: "vi" | "en";
	status?: "published" | "draft";
	categorySlug?: string;
	tagSlugs?: string[];
};

export type PensieveEntry = {
	id: string;
	slug: string;
	url: string;
};

export class PensieveClient {
	constructor(
		private readonly baseUrl: string,
		private readonly token: string,
	) {}

	/** Create a new post. Returns the server-assigned id + slug. */
	async createPost(input: PensieveCreateInput): Promise<PensieveEntry> {
		const body = {
			data: {
				title: input.title,
				excerpt: input.excerpt ?? "",
				content: input.content,
				language: input.language,
				original_language: input.originalLanguage ?? input.language,
			},
			slug: input.slug,
			locale: input.language,
			status: input.status ?? "published",
		};
		const res = await this.request("POST", "/_emdash/api/content/posts", body);
		return this.unwrapEntry(res);
	}

	/** Update an existing post. */
	async updatePost(id: string, input: Partial<PensieveCreateInput>): Promise<PensieveEntry> {
		const body: Record<string, unknown> = { data: {} };
		const data = body.data as Record<string, unknown>;
		if (input.title !== undefined) data.title = input.title;
		if (input.excerpt !== undefined) data.excerpt = input.excerpt;
		if (input.content !== undefined) data.content = input.content;
		if (input.language !== undefined) data.language = input.language;
		const res = await this.request("PATCH", `/_emdash/api/content/posts/${id}`, body);
		return this.unwrapEntry(res);
	}

	/** Assign categories/tags after creation (the create call doesn't accept these inline in all schemas). */
	async setTaxonomy(entryId: string, taxonomyName: string, termSlugs: string[]): Promise<void> {
		await this.request("PUT", `/_emdash/api/content/posts/${entryId}/terms/${taxonomyName}`, {
			slugs: termSlugs,
		});
	}

	private unwrapEntry(res: RequestUrlResponse): PensieveEntry {
		const payload = res.json as { data?: { id: string; slug: string }; entry?: { id: string; slug: string } };
		const entry = payload.data || payload.entry;
		if (!entry || !entry.id || !entry.slug) {
			throw new Error(`Unexpected response shape from EmDash: ${JSON.stringify(payload).slice(0, 200)}`);
		}
		return {
			id: entry.id,
			slug: entry.slug,
			url: `${this.baseUrl}/pensieve/memories/${entry.slug}`,
		};
	}

	private async request(method: string, path: string, body?: unknown): Promise<RequestUrlResponse> {
		const url = `${this.baseUrl}${path}`;
		const res = await requestUrl({
			url,
			method,
			headers: {
				"Authorization": `Bearer ${this.token}`,
				"Content-Type": "application/json",
				"Accept": "application/json",
			},
			body: body ? JSON.stringify(body) : undefined,
			throw: false,
		});
		if (res.status >= 400) {
			const errText = typeof res.text === "string" ? res.text.slice(0, 300) : String(res.status);
			throw new Error(`${method} ${path} → ${res.status}: ${errText}`);
		}
		return res;
	}
}

// Facebook Graph API client. Supports three post shapes:
//   1. Link post (OG-scraped preview card) — postLink()
//   2. Photo post (single/multi image with caption) — postWithPhotos()
//   3. Text-only post — fall back via postWithPhotos with no photos
//
// Photo uploads use the /photos endpoint with `published=false` to create
// "unpublished" media objects. Their IDs are then attached to a /feed post
// via the `attached_media` parameter, which produces a native photo post
// (or album if >1) with the full caption intact.
export class FacebookClient {
	private readonly apiBase = "https://graph.facebook.com/v21.0";

	constructor(
		private readonly pageId: string,
		private readonly accessToken: string,
	) {}

	async postLink(opts: { url: string; message?: string }): Promise<{ id: string }> {
		const params = new URLSearchParams({
			link: opts.url,
			access_token: this.accessToken,
		});
		if (opts.message) params.set("message", opts.message);

		const res = await requestUrl({
			url: `${this.apiBase}/${encodeURIComponent(this.pageId)}/feed`,
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
			throw: false,
		});
		return this.parsePostResponse(res);
	}

	/** Upload a photo by URL. Returns the unpublished media's fbid. */
	async uploadPhotoFromUrl(url: string): Promise<string> {
		const params = new URLSearchParams({
			url,
			published: "false",
			access_token: this.accessToken,
		});
		const res = await requestUrl({
			url: `${this.apiBase}/${encodeURIComponent(this.pageId)}/photos`,
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
			throw: false,
		});
		return this.parseMediaFbid(res);
	}

	/**
	 * Upload a local binary as a photo via multipart/form-data.
	 * `bytes` is the raw binary, `filename` should include the extension so
	 * Facebook infers the mime type correctly.
	 */
	async uploadPhotoFromBytes(bytes: ArrayBuffer, filename: string): Promise<string> {
		const boundary = `----PensievePublisher${Date.now().toString(36)}`;
		const body = buildMultipartBody(boundary, [
			{ name: "published", value: "false" },
			{ name: "access_token", value: this.accessToken },
			{ name: "source", filename, bytes },
		]);
		const res = await requestUrl({
			url: `${this.apiBase}/${encodeURIComponent(this.pageId)}/photos`,
			method: "POST",
			headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
			body,
			throw: false,
		});
		return this.parseMediaFbid(res);
	}

	/**
	 * Post a message with zero or more already-uploaded photos.
	 * `message` is the full plain-text caption. `mediaFbids` is the list of
	 * media IDs returned by uploadPhotoFrom*(). Zero media → plain text post.
	 */
	async postWithPhotos(opts: {
		message: string;
		mediaFbids: string[];
	}): Promise<{ id: string }> {
		const params = new URLSearchParams({
			access_token: this.accessToken,
		});
		if (opts.message) params.set("message", opts.message);
		if (opts.mediaFbids.length > 0) {
			const attached = opts.mediaFbids.map((id) => ({ media_fbid: id }));
			params.set("attached_media", JSON.stringify(attached));
		}
		const res = await requestUrl({
			url: `${this.apiBase}/${encodeURIComponent(this.pageId)}/feed`,
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
			throw: false,
		});
		return this.parsePostResponse(res);
	}

	private parsePostResponse(res: RequestUrlResponse): { id: string } {
		if (res.status >= 400) {
			const errText = typeof res.text === "string" ? res.text.slice(0, 300) : String(res.status);
			throw new Error(`Facebook API ${res.status}: ${errText}`);
		}
		const payload = res.json as { id?: string };
		if (!payload.id) throw new Error("Facebook did not return a post id");
		return { id: payload.id };
	}

	private parseMediaFbid(res: RequestUrlResponse): string {
		if (res.status >= 400) {
			const errText = typeof res.text === "string" ? res.text.slice(0, 300) : String(res.status);
			throw new Error(`Facebook photo upload ${res.status}: ${errText}`);
		}
		const payload = res.json as { id?: string };
		if (!payload.id) throw new Error("Facebook photo upload did not return an id");
		return payload.id;
	}
}

// Minimal multipart/form-data builder. We can't use FormData because Obsidian's
// requestUrl doesn't accept it directly on mobile — it wants an ArrayBuffer or
// string body, so we assemble the multipart bytes by hand.
type MultipartPart =
	| { name: string; value: string }
	| { name: string; filename: string; bytes: ArrayBuffer };

function buildMultipartBody(boundary: string, parts: MultipartPart[]): ArrayBuffer {
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	for (const p of parts) {
		chunks.push(encoder.encode(`--${boundary}\r\n`));
		if ("filename" in p) {
			const mime = guessMimeFromFilename(p.filename);
			chunks.push(
				encoder.encode(
					`Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n` +
						`Content-Type: ${mime}\r\n\r\n`,
				),
			);
			chunks.push(new Uint8Array(p.bytes));
			chunks.push(encoder.encode("\r\n"));
		} else {
			chunks.push(
				encoder.encode(
					`Content-Disposition: form-data; name="${p.name}"\r\n\r\n${p.value}\r\n`,
				),
			);
		}
	}
	chunks.push(encoder.encode(`--${boundary}--\r\n`));
	const total = chunks.reduce((n, c) => n + c.byteLength, 0);
	const out = new Uint8Array(total);
	let pos = 0;
	for (const c of chunks) {
		out.set(c, pos);
		pos += c.byteLength;
	}
	return out.buffer;
}

function guessMimeFromFilename(name: string): string {
	const ext = name.split(".").pop()?.toLowerCase() ?? "";
	switch (ext) {
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "gif":
			return "image/gif";
		case "webp":
			return "image/webp";
		default:
			return "application/octet-stream";
	}
}
