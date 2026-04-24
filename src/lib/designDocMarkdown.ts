import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({ gfm: true, breaks: false });

// Spec/plan docs need richer markup than the Portraits variant: tables for
// decision matrices, code blocks, kbd shortcuts, images. Still whitelist-
// based — these files come from the main repo but PR reviewers may miss
// injected HTML, so we normalize through the same pipeline.
const ALLOWED_TAGS = [
	"p", "br", "hr",
	"strong", "em", "del", "u", "mark", "kbd", "small", "sub", "sup",
	"code", "pre",
	"ul", "ol", "li",
	"blockquote",
	"a",
	"h1", "h2", "h3", "h4", "h5", "h6",
	"table", "thead", "tbody", "tr", "th", "td",
	"img",
	"div", "span",
];

const ALLOWED_ATTR = [
	"href", "title", "name", "id",
	"src", "alt", "width", "height", "loading",
	"class",
	"align", "colspan", "rowspan",
];

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

export function renderDesignDocMarkdown(input: string): RenderResult {
	if (!input || !input.trim()) return { html: "", toc: [] };

	// Render markdown first; inject stable IDs onto h2/h3 via regex and
	// harvest them into the TOC. Cleaner than a custom renderer in marked
	// v18 (which requires threading `this.parser` through token rendering).
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

	const html = DOMPurify.sanitize(withIds, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
		ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
	});
	return { html, toc };
}
