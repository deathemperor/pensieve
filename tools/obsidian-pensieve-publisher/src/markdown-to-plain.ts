// Convert markdown to plain text for Facebook posts. Keeps headings as lines
// with spacing, strips inline syntax while keeping the wrapped text, inlines
// link URLs as "text (url)", removes image references entirely (images get
// attached as media separately), and drops fenced-code fences while keeping
// the code lines as-is.
//
// Output is line-based plain text suitable for the `message` field of a
// Facebook feed post. Facebook's 63,206-character limit is well beyond any
// reasonable blog post.

export type ExtractedImage = {
	raw: string;
	ref: string;
	kind: "remote" | "local";
	alt?: string;
};

export function markdownToPlainText(md: string): string {
	const lines = md.replace(/\r\n/g, "\n").split("\n");
	const out: string[] = [];
	let inFence = false;

	for (const line of lines) {
		if (/^```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			out.push(line);
			continue;
		}

		const noImages = line
			.replace(/!\[\[[^\]]+\]\]/g, "")
			.replace(/!\[[^\]]*\]\([^)]+\)/g, "");

		const heading = /^(#{1,6})\s+(.+)$/.exec(noImages);
		if (heading) {
			if (out.length > 0 && out[out.length - 1] !== "") out.push("");
			out.push(inlineStrip(heading[2].trim()));
			out.push("");
			continue;
		}

		const list = /^(\s*)([-*+]|\d+\.)\s+(.+)$/.exec(noImages);
		if (list) {
			out.push(`${list[1]}• ${inlineStrip(list[3])}`);
			continue;
		}

		out.push(inlineStrip(noImages));
	}

	return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function extractImages(md: string): ExtractedImage[] {
	const images: ExtractedImage[] = [];
	const mdPattern = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
	let m: RegExpExecArray | null;
	while ((m = mdPattern.exec(md)) !== null) {
		const ref = m[2];
		images.push({
			raw: m[0],
			ref,
			kind: /^https?:\/\//i.test(ref) ? "remote" : "local",
			alt: m[1] || undefined,
		});
	}
	const wikiPattern = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
	while ((m = wikiPattern.exec(md)) !== null) {
		const ref = m[1].trim();
		images.push({
			raw: m[0],
			ref,
			kind: /^https?:\/\//i.test(ref) ? "remote" : "local",
			alt: m[2]?.trim(),
		});
	}
	return images;
}

function inlineStrip(text: string): string {
	return text
		.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `${t} (${u})`)
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/\b_([^_]+)_\b/g, "$1")
		.replace(/`([^`]+)`/g, "$1");
}
