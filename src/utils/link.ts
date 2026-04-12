// Blog pages always live under /pensieve/, regardless of Astro's base config.
// Root-level pages (Room of Requirement, Trương) use absolute paths directly.
const PENSIEVE_BASE = "/pensieve/";

export const BASE = PENSIEVE_BASE;

export function link(path: string = ""): string {
	const clean = path.replace(/^\//, "");
	return PENSIEVE_BASE + clean;
}

export function absoluteLink(origin: string, path: string = ""): string {
	const cleanOrigin = origin.replace(/\/$/, "");
	const base = PENSIEVE_BASE.replace(/\/$/, "");
	const clean = path.replace(/^\//, "");
	return clean ? `${cleanOrigin}${base}/${clean}` : `${cleanOrigin}${base}/`;
}
