// PracticePad client — wires the textarea to a live-preview iframe.
// Debounces typing (400ms) before rebuilding the srcdoc; also supports
// Cmd/Ctrl+Enter to force-run, and "Reset from..." dropdown to reload
// the editor from any cursor in source history.

interface HistoryPayload {
  slug: string;
  cursors: Record<string, string>; // cursor index -> hero source at that cursor
}

function stripFrontmatter(source: string): string {
  const m = /^---\n[\s\S]*?\n---\n?/.exec(source);
  return m ? source.slice(m[0].length) : source;
}

function buildSrcdoc(source: string): string {
  const body = stripFrontmatter(source);
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<title>practice</title>
<style>
  html,body{margin:0;padding:0;background:#08090a;width:100%;height:100%;}
  body{display:flex;align-items:center;justify-content:center;overflow:hidden;}
  body > *{width:100%;height:100%;}
</style>
</head><body>
${body}
</body></html>`;
}

function initPracticePad(): void {
  const editor = document.querySelector<HTMLTextAreaElement>("[data-pp-editor]");
  const preview = document.querySelector<HTMLIFrameElement>("[data-pp-preview]");
  const status = document.querySelector<HTMLElement>("[data-pp-status]");
  const runBtn = document.querySelector<HTMLButtonElement>("[data-pp-run]");
  const resetSelect = document.querySelector<HTMLSelectElement>("[data-pp-reset]");
  if (!editor || !preview) return;

  // Pull source history from the inline window global set by the server component
  const pad = document.querySelector<HTMLElement>(".practice-pad");
  const slug = pad?.querySelector<HTMLIFrameElement>("[data-pp-preview]")?.title
    ?.replace(" practice preview", "") ?? "";
  const normalizedSlug = slug.replace(/-/g, "_");
  const historyKey = `__PP_HISTORY_${normalizedSlug}`;
  const history = (window as unknown as Record<string, HistoryPayload | null>)[historyKey];
  const originalSource = editor.value;

  const setStatus = (text: string, cls: string): void => {
    if (!status) return;
    status.textContent = text;
    status.className = `pp-status ${cls}`;
  };

  const run = (): void => {
    setStatus("running", "is-running");
    try {
      preview.setAttribute("srcdoc", buildSrcdoc(editor.value));
      setStatus("ok", "is-ok");
    } catch (e) {
      setStatus("error", "is-error");
      console.error("practice-pad run failed:", e);
    }
  };

  // Initial run
  run();

  // Debounced auto-run
  let debounceId: number | null = null;
  editor.addEventListener("input", () => {
    if (debounceId !== null) window.clearTimeout(debounceId);
    setStatus("editing…", "");
    debounceId = window.setTimeout(() => {
      run();
      debounceId = null;
    }, 400);
  });

  // Cmd/Ctrl+Enter force-run
  editor.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (debounceId !== null) {
        window.clearTimeout(debounceId);
        debounceId = null;
      }
      run();
    }
    // Tab inserts two spaces instead of moving focus
    if (e.key === "Tab") {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value =
        editor.value.slice(0, start) + "  " + editor.value.slice(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
    }
  });

  runBtn?.addEventListener("click", () => run());

  // Populate reset dropdown from history and wire selection
  if (resetSelect && history && history.cursors) {
    const cursors = Object.keys(history.cursors)
      .map(Number)
      .sort((a, b) => a - b);
    for (const c of cursors) {
      const opt = document.createElement("option");
      opt.value = String(c);
      opt.textContent = `Cursor ${c}`;
      resetSelect.appendChild(opt);
    }
    resetSelect.addEventListener("change", () => {
      const value = resetSelect.value;
      if (!value) return;
      let loadSource = "";
      if (value === "final") {
        loadSource = originalSource;
      } else {
        loadSource = history.cursors[value] ?? "";
      }
      if (loadSource) {
        editor.value = loadSource;
        run();
        setStatus(`reset to ${value === "final" ? "final" : `cursor ${value}`}`, "is-ok");
      }
      resetSelect.value = "";
    });
  }
}

document.addEventListener("DOMContentLoaded", initPracticePad);
