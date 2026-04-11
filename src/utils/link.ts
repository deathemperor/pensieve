// Astro's import.meta.env.BASE_URL can be either "/pensieve" or "/pensieve/"
// depending on how `base` is declared. Normalize to always end with a slash so
// concatenation with a path segment is safe.
const RAW_BASE = import.meta.env.BASE_URL || "/";
export const BASE = RAW_BASE.endsWith("/") ? RAW_BASE : RAW_BASE + "/";

export function link(path: string = ""): string {
	const clean = path.replace(/^\//, "");
	return BASE + clean;
}

export function absoluteLink(origin: string, path: string = ""): string {
	const cleanOrigin = origin.replace(/\/$/, "");
	const base = BASE.replace(/\/$/, "");
	const clean = path.replace(/^\//, "");
	return clean ? `${cleanOrigin}${base}/${clean}` : `${cleanOrigin}${base}/`;
}
