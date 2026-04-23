export {};

interface ChronicleEntryData {
  id: string;
  title: string;
  subtitle?: string;
  roman_date: string;
  location?: { name?: string; city?: string; country?: string; lat?: number; lng?: number };
  external_url?: string;
  external_url_label?: string;
  linked_post_slugs?: string[];
}

declare global {
  interface Window {
    __CHRONICLE_ENTRIES__: Record<string, ChronicleEntryData>;
    __CHRONICLE_LANG__: "en" | "vi";
  }
}

(() => {
  const frame = document.getElementById("cc-frame");
  if (!frame) return;

  const isVi = window.__CHRONICLE_LANG__ === "vi";
  const ZOOM_MIN = 0.7;
  const ZOOM_MAX = 1.6;
  const ZOOM_STEP = 0.1;

  // ---------- Cross-highlight ----------
  function setActive(id: string | null) {
    document.querySelectorAll("[data-id][data-active]").forEach((el) => {
      if (el.getAttribute("data-id") !== id) el.removeAttribute("data-active");
    });
    if (id) {
      document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach((el) => {
        el.setAttribute("data-active", "");
      });
    }
  }

  document.querySelectorAll<HTMLElement>(".cc-star, .cc-entry, .cc-atlas-place").forEach((el) => {
    const id = el.dataset.id;
    if (!id) return;
    el.addEventListener("mouseenter", () => setActive(id));
    el.addEventListener("mouseleave", () => setActive(null));
    el.addEventListener("click", () => openModal(id));
  });

  // SVG atlas pins — SVGGElement.dataset is standard on modern browsers.
  document.querySelectorAll<SVGGElement>(".cc-atlas-pin").forEach((el) => {
    const id = el.dataset.id;
    if (!id) return;
    el.addEventListener("mouseenter", () => setActive(id));
    el.addEventListener("mouseleave", () => setActive(null));
    el.addEventListener("click", () => openModal(id));
  });

  // ---------- Modal ----------
  const modal = document.getElementById("cc-modal");
  const closeBtn = modal?.querySelector<HTMLButtonElement>(".cc-modal-close");

  function openModal(id: string) {
    if (!modal) return;
    const data = window.__CHRONICLE_ENTRIES__?.[id];
    if (!data) return;
    modal.querySelector<HTMLElement>('[data-slot="title"]')!.textContent = data.title;
    modal.querySelector<HTMLElement>('[data-slot="date"]')!.textContent = data.roman_date;

    const sub = modal.querySelector<HTMLElement>('[data-slot="subtitle"]')!;
    if (data.subtitle) { sub.textContent = data.subtitle; sub.style.display = ""; }
    else { sub.style.display = "none"; }

    const loc = modal.querySelector<HTMLElement>('[data-slot="location"]')!;
    if (data.location?.name) {
      loc.textContent = [data.location.name, data.location.city, data.location.country]
        .filter(Boolean).join(" · ");
      loc.style.display = "";
    } else {
      loc.style.display = "none";
    }

    const links = modal.querySelector<HTMLElement>('[data-slot="links"]')!;
    links.replaceChildren();
    if (data.external_url) {
      const a = document.createElement("a");
      a.href = data.external_url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `▸ ${data.external_url_label ?? (isVi ? "mở" : "open")}`;
      a.style.color = "var(--chronicle-gold)";
      links.appendChild(a);
    }
    for (const slug of data.linked_post_slugs ?? []) {
      const a = document.createElement("a");
      a.href = `/pensieve/memories/${slug}`;
      a.textContent = `▸ ${isVi ? "ký ức liên quan" : "linked memory"}`;
      a.style.color = "var(--chronicle-gold)";
      links.appendChild(a);
    }
    if (data.location && typeof data.location.lat === "number" && typeof data.location.lng === "number") {
      const mapLink = document.createElement("a");
      mapLink.href = `https://www.openstreetmap.org/?mlat=${data.location.lat}&mlon=${data.location.lng}&zoom=14`;
      mapLink.target = "_blank";
      mapLink.rel = "noopener noreferrer";
      mapLink.textContent = `▸ ${isVi ? "xem trên bản đồ" : "open in map"}`;
      mapLink.style.color = "var(--chronicle-gold)";
      links.appendChild(mapLink);
    }
    // Permalink — keep last so it's a subtle footer action
    {
      const p = document.createElement("a");
      p.href = `/pensieve/chronicle/${data.id}`;
      p.textContent = `▸ ${isVi ? "liên kết cố định" : "permalink"}`;
      p.style.color = "rgba(212, 168, 67, 0.6)";
      p.style.fontSize = "11px";
      p.style.marginTop = "6px";
      links.appendChild(p);
    }

    modal.setAttribute("data-open", "");
  }

  function closeModal() {
    modal?.removeAttribute("data-open");
  }

  closeBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // Modal arrow-nav — when modal is open, ←/→ jump to adjacent ledger entries.
  const ledgerIds = Array.from(document.querySelectorAll<HTMLElement>(".cc-entry"))
    .map((el) => el.dataset.id)
    .filter((id): id is string => typeof id === "string");
  function modalNav(dir: -1 | 1) {
    if (!modal?.hasAttribute("data-open")) return;
    const currentTitle = modal.querySelector<HTMLElement>('[data-slot="title"]')?.textContent;
    if (!currentTitle) return;
    const currentId = Object.entries(window.__CHRONICLE_ENTRIES__ ?? {})
      .find(([, v]) => v.title === currentTitle)?.[0];
    if (!currentId) return;
    const idx = ledgerIds.indexOf(currentId);
    if (idx < 0) return;
    const nextIdx = (idx + dir + ledgerIds.length) % ledgerIds.length;
    openModal(ledgerIds[nextIdx]);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeModal(); return; }
    if (!modal?.hasAttribute("data-open")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); modalNav(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); modalNav(1); }
  });

  // ---------- Category filter chips ----------
  const frameEl = document.getElementById("cc-frame");
  let activeFilter: string | null = null;
  function applyFilter(slug: string | null) {
    activeFilter = slug;
    if (!frameEl) return;
    if (slug) frameEl.setAttribute("data-filter", slug);
    else frameEl.removeAttribute("data-filter");
    document.querySelectorAll<HTMLElement>("[data-legend-category]").forEach((el) => {
      if (slug && el.dataset.legendCategory === slug) el.setAttribute("data-legend-active", "");
      else el.removeAttribute("data-legend-active");
    });
    document.querySelectorAll<HTMLElement>("[data-category]").forEach((el) => {
      if (!slug || el.dataset.category === slug) el.setAttribute("data-category-match", "");
      else el.removeAttribute("data-category-match");
    });
  }
  document.querySelectorAll<HTMLElement>("[data-legend-category]").forEach((chip) => {
    const slug = chip.dataset.legendCategory;
    const toggle = () => applyFilter(activeFilter === slug ? null : (slug ?? null));
    chip.addEventListener("click", toggle);
    chip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });

  // ---------- Zoom ----------
  const frameRoot = document.documentElement;
  const readout = document.querySelector<HTMLElement>("[data-zoom-readout]");
  const initial = parseFloat(
    getComputedStyle(frameRoot).getPropertyValue("--chronicle-zoom-scale") || "1",
  );
  let zoom = Number.isFinite(initial) && initial > 0 ? initial : 1;
  function setZoom(next: number) {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    frameRoot.style.setProperty("--chronicle-zoom-scale", String(zoom));
    if (readout) readout.textContent = `${zoom.toFixed(1)}×`;
  }
  setZoom(zoom);

  document.querySelectorAll<HTMLButtonElement>(".cc-zoom-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.zoom;
      if (action === "in") setZoom(zoom + ZOOM_STEP);
      else if (action === "out") setZoom(zoom - ZOOM_STEP);
      else if (action === "reset") setZoom(1);
    });
  });

  // ---------- Back-to-top on ledger ----------
  const ledger = document.getElementById("cc-ledger");
  const backBtn = ledger?.querySelector<HTMLButtonElement>("[data-back-to-top]");
  if (ledger && backBtn) {
    const updateBackVisibility = () => {
      if (ledger.scrollTop > 180) backBtn.setAttribute("data-visible", "");
      else backBtn.removeAttribute("data-visible");
    };
    ledger.addEventListener("scroll", updateBackVisibility, { passive: true });
    backBtn.addEventListener("click", () => {
      ledger.scrollTo({ top: 0, behavior: "smooth" });
    });
    updateBackVisibility();
  }

  // ---------- Year jump (scrolls ledger + pulses matching Sky ring) ----------
  (document.querySelector(".cc-year-jump") as unknown as HTMLSelectElement | null)?.addEventListener("change", (e) => {
    const target = (e.currentTarget as unknown as HTMLSelectElement).value;
    if (!target) return;
    document.getElementById(`cc-year-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelectorAll("[data-year]").forEach((el) => el.removeAttribute("data-year-active"));
    document
      .querySelectorAll(`[data-year="${CSS.escape(target)}"]`)
      .forEach((el) => el.setAttribute("data-year-active", ""));
  });

  // ---------- Arrow-key navigation between stars ----------
  const stars = Array.from(document.querySelectorAll<HTMLElement>(".cc-star"));
  if (stars.length > 0) {
    document.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement | null;
      // Only handle when a star is already focused — don't hijack other inputs.
      if (!target || !target.classList.contains("cc-star")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const idx = stars.indexOf(target);
      if (idx < 0) return;
      const next = e.key === "ArrowLeft" || e.key === "ArrowUp"
        ? (idx - 1 + stars.length) % stars.length
        : (idx + 1) % stars.length;
      stars[next].focus();
      const nextId = stars[next].dataset.id;
      if (nextId) setActive(nextId);
    });
  }
  // ---------- Keyboard shortcut overlay ----------
  const overlay = document.querySelector<HTMLElement>(".cc-shortcut-overlay");
  const openBtn = document.querySelector<HTMLButtonElement>("[data-shortcut-open]");
  const closeShortcutBtn = overlay?.querySelector<HTMLButtonElement>("[data-shortcut-close]");
  function toggleShortcuts(force?: boolean) {
    if (!overlay) return;
    const shouldOpen = force ?? !overlay.hasAttribute("data-open");
    if (shouldOpen) overlay.setAttribute("data-open", "");
    else overlay.removeAttribute("data-open");
  }
  openBtn?.addEventListener("click", () => toggleShortcuts(true));
  closeShortcutBtn?.addEventListener("click", () => toggleShortcuts(false));
  overlay?.addEventListener("click", (e) => { if (e.target === overlay) toggleShortcuts(false); });
  document.addEventListener("keydown", (e) => {
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
    if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
      e.preventDefault();
      toggleShortcuts();
    }
    if (e.key === "Escape" && overlay?.hasAttribute("data-open")) {
      toggleShortcuts(false);
    }
  });
})();
