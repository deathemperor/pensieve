import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

// Design docs come from our own git repo, so the content is trusted
// by virtue of code review. We skip a full HTML sanitizer (isomorphic-
// dompurify fails at runtime on Cloudflare Workers: "Cannot read
// properties of undefined reading 'bind'") and instead apply a
// defense-in-depth regex that strips the few tags marked cannot emit
// but inline HTML passthrough can carry — <script>, <iframe>, <style>,
// and event-handler attributes. Nothing else is filtered; specs may
// legitimately use tables, images, kbd, code, etc.

export interface RenderResult {
	html: string;
	toc: Array<{ level: number; text: string; id: string }>;
}

function slugify(raw: string): string {
	return raw
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

const DANGEROUS_TAGS = /<\s*\/?\s*(script|iframe|object|embed|style|link|meta)\b[^>]*>/gi;
const INLINE_EVENT_HANDLERS = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URI = /(href|src)\s*=\s*(["']?)\s*javascript:/gi;

function sanitize(html: string): string {
	return html
		.replace(DANGEROUS_TAGS, "")
		.replace(INLINE_EVENT_HANDLERS, "")
		.replace(JAVASCRIPT_URI, "$1=$2#blocked:");
}

export function renderDesignDocMarkdown(input: string): RenderResult {
	if (!input || !input.trim()) return { html: "", toc: [] };

	const raw = marked.parse(input, { async: false }) as string;
	const toc: RenderResult["toc"] = [];
	const seen = new Map<string, number>();

	const withIds = raw.replace(/<h([23])>([\s\S]+?)<\/h\1>/g, (_m, levelStr: string, inner: string) => {
		const level = Number(levelStr);
		const plain = inner.replace(/<[^>]+>/g, "").trim();
		let id = slugify(plain);
		if (!id) id = `h-${toc.length}`;
		const count = seen.get(id) ?? 0;
		seen.set(id, count + 1);
		if (count > 0) id = `${id}-${count + 1}`;
		toc.push({ level, text: plain, id });
		return `<h${level} id="${id}">${inner}</h${level}>`;
	});

	return { html: sanitize(withIds), toc };
}
