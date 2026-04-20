/**
 * Turn an Astro component's source code into a self-contained HTML document
 * suitable for `<iframe srcdoc={...}>`. Strips the `---...---` frontmatter
 * (which is server-side TS and has no runtime equivalent) and wraps the
 * remainder — template HTML + <style> blocks — in a minimal HTML shell.
 *
 * Pure function, no DOM deps, safe to call from both server and client.
 */
export function reconstructIframeSrcdoc(source: string, cursor: number): string {
  const withoutFrontmatter = stripFrontmatter(source);
  const marker = `<!-- animation-cursor: ${cursor} -->`;
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<title>cursor ${cursor}</title>
${marker}
<style>
  html,body{margin:0;padding:0;background:#08090a;width:100%;height:100%;}
  body{display:flex;align-items:center;justify-content:center;overflow:hidden;}
  body > *{width:100%;height:100%;}
</style>
</head><body>
${withoutFrontmatter}
</body></html>`;
}

function stripFrontmatter(source: string): string {
  const m = /^---\n[\s\S]*?\n---\n?/.exec(source);
  return m ? source.slice(m[0].length) : source;
}

/**
 * Choose the "hero" file for a cursor — the file under `src/animations/<slug>/`
 * that is (a) an .astro file, (b) most recently touched. For snitch-trail
 * there is only one, index.astro.
 */
export function pickHeroSource(
  files: Record<string, string>,
  slug: string,
): { path: string; source: string } | null {
  const prefix = `src/animations/${slug}/`;
  const candidates = Object.entries(files).filter(
    ([p]) => p.startsWith(prefix) && p.endsWith(".astro"),
  );
  if (candidates.length === 0) return null;
  // Prefer index.astro if present, else the first
  const index = candidates.find(([p]) => p.endsWith("/index.astro"));
  const [path, source] = index ?? candidates[0];
  return { path, source };
}
