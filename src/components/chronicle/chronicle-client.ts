export {};

interface ChronicleEntryData {
  id: string;
  title: string;
  subtitle?: string;
  roman_date: string;
  location?: { name?: string; city?: string; country?: string };
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

    modal.setAttribute("data-open", "");
  }

  function closeModal() {
    modal?.removeAttribute("data-open");
  }

  closeBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

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

  // ---------- Year jump ----------
  (document.querySelector(".cc-year-jump") as unknown as HTMLSelectElement | null)?.addEventListener("change", (e) => {
    const target = (e.currentTarget as unknown as HTMLSelectElement).value;
    if (!target) return;
    document.getElementById(`cc-year-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
