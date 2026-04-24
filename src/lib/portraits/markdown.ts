import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(input: string): string {
  if (!input || !input.trim()) return "";
  const raw = marked.parse(input, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ["p","br","strong","em","del","code","pre","ul","ol","li","blockquote","a","h1","h2","h3","h4","h5","h6","hr"],
    ALLOWED_ATTR: ["href","title"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
  });
}
