// Minimal markdown to Portable Text converter. Covers the cases that show up
// in real long-form writing: paragraphs, headings h1-h3, inline bold/italic/
// code, links, fenced code blocks, unordered and ordered lists. Everything
// else (tables, blockquotes, images) falls through as a plain text block so
// the draft is never lost — it just needs post-publish cleanup in the admin
// UI. Keep this small; anything fancier belongs server-side.

export type PortableTextBlock = {
	_type: "block";
	_key: string;
	style: "normal" | "h1" | "h2" | "h3";
	markDefs: PortableTextMarkDef[];
	children: PortableTextSpan[];
	listItem?: "bullet" | "number";
	level?: number;
};

type PortableTextSpan = {
	_type: "span";
	_key: string;
	text: string;
	marks: string[];
};

type PortableTextCodeBlock = {
	_type: "code";
	_key: string;
	language: string;
	code: string;
};

type PortableTextMarkDef = {
	_key: string;
	_type: "link";
	href: string;
};

type AnyBlock = PortableTextBlock | PortableTextCodeBlock;

let keyCounter = 0;
function nextKey(): string {
	return `k${(keyCounter++).toString(36)}`;
}

export function markdownToPortableText(md: string): AnyBlock[] {
	keyCounter = 0;
	const blocks: AnyBlock[] = [];
	const lines = md.replace(/\r\n/g, "\n").split("\n");

	let i = 0;
	let paragraphLines: string[] = [];

	function flushParagraph() {
		if (paragraphLines.length === 0) return;
		const text = paragraphLines.join(" ").trim();
		paragraphLines = [];
		if (!text) return;
		blocks.push(buildInlineBlock("normal", text));
	}

	while (i < lines.length) {
		const line = lines[i];

		const fence = /^```(\w+)?\s*$/.exec(line);
		if (fence) {
			flushParagraph();
			const lang = fence[1] || "text";
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !/^```\s*$/.test(lines[i])) {
				codeLines.push(lines[i]);
				i++;
			}
			blocks.push({
				_type: "code",
				_key: nextKey(),
				language: lang,
				code: codeLines.join("\n"),
			});
			i++;
			continue;
		}

		const heading = /^(#{1,3})\s+(.+)$/.exec(line);
		if (heading) {
			flushParagraph();
			const level = heading[1].length as 1 | 2 | 3;
			const style = (`h${level}` as "h1" | "h2" | "h3");
			blocks.push(buildInlineBlock(style, heading[2].trim()));
			i++;
			continue;
		}

		const list = /^(\s*)([-*+]|\d+\.)\s+(.+)$/.exec(line);
		if (list) {
			flushParagraph();
			const indent = list[1].length;
			const level = Math.floor(indent / 2) + 1;
			const ordered = /^\d+\./.test(list[2]);
			const block = buildInlineBlock("normal", list[3].trim());
			block.listItem = ordered ? "number" : "bullet";
			block.level = level;
			blocks.push(block);
			i++;
			continue;
		}

		if (/^\s*$/.test(line)) {
			flushParagraph();
			i++;
			continue;
		}

		paragraphLines.push(line);
		i++;
	}
	flushParagraph();

	return blocks;
}

function buildInlineBlock(
	style: PortableTextBlock["style"],
	text: string,
): PortableTextBlock {
	const markDefs: PortableTextMarkDef[] = [];
	const children: PortableTextSpan[] = [];
	const tokens = tokenizeInline(text);

	for (const t of tokens) {
		if (t.kind === "text") {
			children.push({ _type: "span", _key: nextKey(), text: t.text, marks: [] });
		} else if (t.kind === "link") {
			const markKey = nextKey();
			markDefs.push({ _key: markKey, _type: "link", href: t.href });
			children.push({ _type: "span", _key: nextKey(), text: t.text, marks: [markKey] });
		} else {
			children.push({ _type: "span", _key: nextKey(), text: t.text, marks: [t.kind] });
		}
	}

	if (children.length === 0) {
		children.push({ _type: "span", _key: nextKey(), text: "", marks: [] });
	}

	return { _type: "block", _key: nextKey(), style, markDefs, children };
}

type InlineToken =
	| { kind: "text"; text: string }
	| { kind: "strong" | "em" | "code"; text: string }
	| { kind: "link"; text: string; href: string };

function tokenizeInline(text: string): InlineToken[] {
	const tokens: InlineToken[] = [];
	let pos = 0;
	const n = text.length;

	while (pos < n) {
		const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(pos));
		if (linkMatch) {
			tokens.push({ kind: "link", text: linkMatch[1], href: linkMatch[2] });
			pos += linkMatch[0].length;
			continue;
		}

		if (text[pos] === "`") {
			const end = text.indexOf("`", pos + 1);
			if (end > pos) {
				tokens.push({ kind: "code", text: text.slice(pos + 1, end) });
				pos = end + 1;
				continue;
			}
		}

		if (text.startsWith("**", pos)) {
			const end = text.indexOf("**", pos + 2);
			if (end > pos) {
				tokens.push({ kind: "strong", text: text.slice(pos + 2, end) });
				pos = end + 2;
				continue;
			}
		}

		if (text[pos] === "*" && text[pos + 1] !== "*") {
			const end = text.indexOf("*", pos + 1);
			if (end > pos && text[end - 1] !== " ") {
				tokens.push({ kind: "em", text: text.slice(pos + 1, end) });
				pos = end + 1;
				continue;
			}
		}

		let next = pos + 1;
		while (next < n && text[next] !== "[" && text[next] !== "`" && text[next] !== "*") {
			next++;
		}
		const slice = text.slice(pos, next);
		const last = tokens[tokens.length - 1];
		if (last && last.kind === "text") {
			last.text += slice;
		} else {
			tokens.push({ kind: "text", text: slice });
		}
		pos = next;
	}

	return tokens;
}
