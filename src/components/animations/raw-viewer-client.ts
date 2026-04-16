// Client-side scrubber for RawViewer.astro.
// Keeps the URL hash (#cursor-N) in sync with the current selection,
// supports arrow-key navigation, and highlights the chapter whose
// cursor_index is the most recent <= current cursor.

function init(): void {
  const viewer = document.querySelector<HTMLElement>(".raw-viewer");
  if (!viewer) return;

  const entries = Array.from(viewer.querySelectorAll<HTMLElement>(".entry"));
  const chapterLinks = Array.from(
    viewer.querySelectorAll<HTMLAnchorElement>(".chapters a"),
  );
  if (entries.length === 0) return;

  const cursorFromHash = (): number => {
    const m = /#cursor-(\d+)/.exec(window.location.hash);
    return m ? parseInt(m[1], 10) : 0;
  };

  const timelineDots = Array.from(
    document.querySelectorAll<HTMLElement>(".timeline-dot"),
  );
  const timeline = document.querySelector<HTMLElement>(".tool-timeline");
  const cursorNow = document.querySelector<HTMLElement>(".cursor-now");

  const setCurrent = (cursor: number): void => {
    for (const e of entries) {
      e.classList.toggle("is-current", Number(e.dataset.cursor) === cursor);
    }
    for (const d of timelineDots) {
      d.classList.toggle("is-current", Number(d.dataset.cursor) === cursor);
    }
    if (cursorNow) cursorNow.textContent = String(cursor);

    const chapterCursors = chapterLinks
      .map((a) => Number(a.dataset.cursor))
      .sort((a, b) => a - b);
    const active = chapterCursors.filter((c) => c <= cursor).pop();
    for (const a of chapterLinks) {
      const isActive = Number(a.dataset.cursor) === active;
      if (isActive) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }

    const next = `#cursor-${cursor}`;
    if (window.location.hash !== next) {
      history.replaceState(null, "", next);
    }
  };

  const step = (delta: number): void => {
    const current = cursorFromHash();
    const max = entries.length - 1;
    const next = Math.max(0, Math.min(max, current + delta));
    const el = viewer.querySelector<HTMLElement>(`#cursor-${next}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setCurrent(next);
  };

  // Filter pills — set data-filter on the viewer root; CSS handles visibility.
  const FILTER_STORAGE_KEY = "raw-viewer-filter";
  const VALID_FILTERS = ["all", "signal", "edits", "prompts"] as const;
  type Filter = (typeof VALID_FILTERS)[number];
  const isValidFilter = (v: string | null): v is Filter =>
    !!v && (VALID_FILTERS as readonly string[]).includes(v);

  const pills = Array.from(viewer.querySelectorAll<HTMLButtonElement>(".pill"));
  const applyFilter = (filter: Filter): void => {
    viewer.setAttribute("data-filter", filter);
    for (const p of pills) {
      p.classList.toggle("is-active", p.dataset.filter === filter);
    }
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, filter);
    } catch {
      // localStorage may be disabled — that's fine, filter still applies for this session
    }
  };

  const savedFilter = (() => {
    try {
      return window.localStorage.getItem(FILTER_STORAGE_KEY);
    } catch {
      return null;
    }
  })();
  const initialFilter: Filter = isValidFilter(savedFilter) ? savedFilter : "signal";
  applyFilter(initialFilter);

  for (const pill of pills) {
    pill.addEventListener("click", () => {
      const f = pill.dataset.filter;
      if (isValidFilter(f ?? null)) applyFilter(f as Filter);
    });
  }

  // Transport controls — play/pause, prev/next, speed.
  const SPEEDS = [1, 2, 4] as const;
  let speedIdx = 0;
  let playTimer: number | null = null;
  const speedLabel = document.querySelector<HTMLElement>(".speed-label");
  const playBtn = document.querySelector<HTMLButtonElement>('.transport-btn[data-transport="play"]');
  const prevBtn = document.querySelector<HTMLButtonElement>('.transport-btn[data-transport="prev"]');
  const nextBtn = document.querySelector<HTMLButtonElement>('.transport-btn[data-transport="next"]');
  const speedBtn = document.querySelector<HTMLButtonElement>('.transport-btn[data-transport="speed"]');

  const stopPlay = (): void => {
    if (playTimer !== null) {
      window.clearInterval(playTimer);
      playTimer = null;
    }
    timeline?.classList.remove("is-playing");
    if (playBtn) playBtn.setAttribute("aria-label", "Play");
  };

  const startPlay = (): void => {
    stopPlay();
    const maxCursor = entries.length - 1;
    // If we're at the end, restart from the beginning on play
    if (cursorFromHash() >= maxCursor) {
      setCurrent(0);
    }
    timeline?.classList.add("is-playing");
    if (playBtn) playBtn.setAttribute("aria-label", "Pause");
    const intervalMs = Math.max(60, 500 / SPEEDS[speedIdx]);
    playTimer = window.setInterval(() => {
      const c = cursorFromHash();
      if (c >= maxCursor) {
        stopPlay();
        return;
      }
      step(1);
    }, intervalMs);
  };

  playBtn?.addEventListener("click", () => {
    if (playTimer !== null) stopPlay();
    else startPlay();
  });

  prevBtn?.addEventListener("click", () => {
    stopPlay();
    step(-1);
  });
  nextBtn?.addEventListener("click", () => {
    stopPlay();
    step(1);
  });

  speedBtn?.addEventListener("click", () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    if (speedLabel) speedLabel.textContent = `${SPEEDS[speedIdx]}×`;
    // If currently playing, restart with new speed
    if (playTimer !== null) startPlay();
  });

  window.addEventListener("hashchange", () => setCurrent(cursorFromHash()));

  document.addEventListener("keydown", (ev: KeyboardEvent) => {
    if (ev.target && (ev.target as HTMLElement).closest("input,textarea,select")) return;
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
      ev.preventDefault();
      stopPlay();
      step(1);
    } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
      ev.preventDefault();
      stopPlay();
      step(-1);
    } else if (ev.key === " " || ev.key === "Spacebar") {
      ev.preventDefault();
      if (playTimer !== null) stopPlay();
      else startPlay();
    }
  });

  setCurrent(cursorFromHash());
}

document.addEventListener("DOMContentLoaded", init);
