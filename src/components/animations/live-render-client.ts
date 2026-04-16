// Syncs the Live Render iframe to the current cursor. Reads the
// pre-loaded source history from window.__ANIM_SOURCE_HISTORY_<slug>
// (set by the server component), listens on URL hash changes from the
// raw viewer's scrubber, and rebuilds the iframe srcdoc.

interface SourceHistoryCursor {
  cursor: number;
  files: Record<string, string>;
}
interface SourceHistory {
  slugPrefix: string;
  cursors: Record<string, SourceHistoryCursor>;
}

function reconstructSrcdoc(source: string, cursor: number): string {
  const fence = /^---\n[\s\S]*?\n---\n?/.exec(source);
  const body = fence ? source.slice(fence[0].length) : source;
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>cursor ${cursor}</title>
<!-- animation-cursor: ${cursor} -->
<style>
  html,body{margin:0;padding:0;background:#08090a;width:100%;height:100%;}
  body{display:flex;align-items:center;justify-content:center;overflow:hidden;}
  body > *{width:100%;height:100%;}
</style>
</head><body>
${body}
</body></html>`;
}

function pickHero(files: Record<string, string>, slug: string): string | null {
  const prefix = `src/animations/${slug}/`;
  const candidates = Object.entries(files).filter(
    ([p]) => p.startsWith(prefix) && p.endsWith(".astro"),
  );
  if (candidates.length === 0) return null;
  const idx = candidates.find(([p]) => p.endsWith("/index.astro"));
  return (idx ?? candidates[0])[1];
}

function stateAt(history: SourceHistory, cursor: number): SourceHistoryCursor | null {
  const keys = Object.keys(history.cursors)
    .map(Number)
    .filter((c) => c <= cursor)
    .sort((a, b) => a - b);
  const last = keys[keys.length - 1];
  if (last === undefined) return null;
  return history.cursors[String(last)] ?? null;
}

function initLiveRender(): void {
  const frame = document.querySelector<HTMLIFrameElement>(".live-frame");
  if (!frame) return;
  const slug = frame.dataset.slug;
  if (!slug) return;
  const key = `__ANIM_SOURCE_HISTORY_${slug.replace(/-/g, "_")}`;
  const history = (window as unknown as Record<string, SourceHistory | null>)[key];
  if (!history) return;

  const cursorFromHash = (): number => {
    const m = /#cursor-(\d+)/.exec(window.location.hash);
    return m ? parseInt(m[1], 10) : 0;
  };

  const update = (cursor: number): void => {
    const st = stateAt(history, cursor);
    if (!st) return;
    const src = pickHero(st.files, slug);
    if (!src) return;
    frame.setAttribute("srcdoc", reconstructSrcdoc(src, cursor));
    frame.setAttribute("title", `${slug} render at cursor ${cursor}`);
  };

  window.addEventListener("hashchange", () => update(cursorFromHash()));
  // Initial sync if page loaded with a hash
  const initial = cursorFromHash();
  if (initial !== Number(frame.dataset.initialCursor)) update(initial);
}

document.addEventListener("DOMContentLoaded", initLiveRender);
