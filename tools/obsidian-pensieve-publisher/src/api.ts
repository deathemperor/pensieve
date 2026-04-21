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

// Facebook Graph API client. Posts a link-preview to a page feed. We deliberately
// post the URL of the just-published Pensieve post rather than the body text —
// Facebook will scrape OG tags and render a proper preview card.
export class FacebookClient {
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
			url: `https://graph.facebook.com/v21.0/${encodeURIComponent(this.pageId)}/feed`,
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
			throw: false,
		});
		if (res.status >= 400) {
			const errText = typeof res.text === "string" ? res.text.slice(0, 300) : String(res.status);
			throw new Error(`Facebook API ${res.status}: ${errText}`);
		}
		const payload = res.json as { id?: string };
		if (!payload.id) throw new Error("Facebook did not return a post id");
		return { id: payload.id };
	}
}
