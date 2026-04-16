# Room of Requirement Hub Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Room of Requirement from a long 7-section vertical page into a compact hub dashboard with summary panels, sub-pages for growing sections, and per-panel HP-themed click animations.

**Architecture:** The RoR index becomes a 2-column CSS grid of summary panels below the hero. Four navigable panels link to sub-pages (Task Observatory, Restricted Section, House-Elves, Plugins). Three panels stay inline (What CC Does, Architecture, Source). Each panel has a unique HP-themed click transition. Animations are CSS keyframes + View Transitions API with progressive fallback.

**Tech Stack:** Astro SSR, Cloudflare D1, CSS @keyframes, View Transitions API, vanilla JS (particle spawning only)

**Spec:** `docs/superpowers/specs/2026-04-14-ror-hub-dashboard-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/pages/room-of-requirement/index.astro` | Rewrite | Hub dashboard with grid panels + animations |
| `src/pages/room-of-requirement/restricted-section.astro` | Create | Dedicated Restricted Section page (moved from index) |
| `src/pages/room-of-requirement/house-elves.astro` | Create | Dedicated House-Elves page |
| `src/pages/room-of-requirement/plugins.astro` | Create | Dedicated Plugins page |
| `src/data/site-routes.json` | Modify | Add 3 new sub-page routes |

---

### Task 1: Create Restricted Section sub-page

Extract the Restricted Section from the index into its own page. This is a straight lift — same D1 query, same HTML, wrapped in Base layout.

**Files:**
- Create: `src/pages/room-of-requirement/restricted-section.astro`

- [ ] **Step 1: Create the page with D1 query**

```astro
---
export const prerender = false;

import Base from "../../layouts/Base.astro";
import { getCurrentLang } from "../../utils/lang";
import { env } from "cloudflare:workers";

const isVi = getCurrentLang(Astro) === "vi";
const db = env.DB;

let designDocs: { id: string; title: string; doc_type: string; project: string; summary: string; prompt: string; file_path: string; notion_url: string; line_count: number; created_at: string }[] = [];

if (db) {
  try {
    const docs = await db.prepare(
      "SELECT * FROM design_docs ORDER BY project, doc_type DESC"
    ).all();
    designDocs = (docs.results ?? []) as any[];
  } catch {
    designDocs = [];
  }
}

const docsByProject = new Map<string, typeof designDocs>();
for (const doc of designDocs) {
  const existing = docsByProject.get(doc.project) ?? [];
  existing.push(doc);
  docsByProject.set(doc.project, existing);
}

const projectDisplayNames: Record<string, string> = {
  "hp-task-management": "HP Task Management",
  "hogwarts-library": "Hogwarts Library",
};

const totalSpecs = designDocs.filter(d => d.doc_type === 'spec').length;
const totalPlans = designDocs.filter(d => d.doc_type === 'plan').length;
const totalLines = designDocs.reduce((sum, d) => sum + (d.line_count ?? 0), 0);
---
```

- [ ] **Step 2: Add the HTML template**

Copy the Restricted Section HTML from `src/pages/room-of-requirement/index.astro` lines 284–355 (the `<section class="room-section">` containing the RS). Wrap it in `<Base>` with breadcrumbs:

```astro
<Base
  title={isVi ? "Khu Cấm" : "The Restricted Section"}
  description={isVi ? "Bản thiết kế và kế hoạch triển khai" : "Design specs and implementation plans"}
  breadcrumbs={[
    { label: "Room of Requirement", href: "/room-of-requirement" },
    { label: isVi ? "Khu Cấm" : "The Restricted Section" },
  ]}
>
  <!-- paste the RS section content here (without the outer <section> wrapper — use the inner content) -->
</Base>
```

- [ ] **Step 3: Add the RS CSS**

Copy all `.rs-*` styles from the index page's `<style>` block into this page's own `<style>` block. These are lines 698–896 of the current index.astro.

- [ ] **Step 4: Build and verify**

```bash
npx astro build 2>&1 | tail -5
```

Expected: `Build complete!` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/room-of-requirement/restricted-section.astro
git commit -m "feat: extract Restricted Section into dedicated sub-page"
```

---

### Task 2: Create House-Elves sub-page

**Files:**
- Create: `src/pages/room-of-requirement/house-elves.astro`

- [ ] **Step 1: Create the page**

```astro
---
export const prerender = false;

import Base from "../../layouts/Base.astro";
import { getCurrentLang } from "../../utils/lang";

const isVi = getCurrentLang(Astro) === "vi";

const agents = [
  {
    name: "session-logger",
    purpose: isVi ? "Ghi nhật ký xây dựng có cấu trúc sau mỗi phiên làm việc" : "Appends structured entries to the build diary after each work session",
  },
  {
    name: "moderate-comments",
    purpose: isVi ? "Duyệt, phê duyệt, đánh dấu spam, xóa bình luận qua API quản trị EmDash" : "Lists, approves, spams, trashes, or deletes comments via the EmDash admin API",
  },
  {
    name: "Explore",
    purpose: isVi ? "Khám phá codebase nhanh — tìm file, tìm kiếm code, trả lời câu hỏi kiến trúc" : "Fast codebase exploration — finds files, searches code, answers architecture questions",
  },
  {
    name: "Plan",
    purpose: isVi ? "Thiết kế chiến lược triển khai, xác định file quan trọng, cân nhắc đánh đổi" : "Designs implementation strategies, identifies critical files, weighs trade-offs",
  },
  {
    name: "geminio",
    purpose: isVi ? "Cảnh sát i18n — đảm bảo mọi text đều có song ngữ EN/VI" : "i18n police — ensures all text has bilingual EN/VI versions",
  },
  {
    name: "argus-filch",
    purpose: isVi ? "Tìm lỗi và sửa — tuần tra codebase tìm link hỏng, import thiếu, lỗi runtime" : "Bug finder — patrols codebase for broken links, missing imports, runtime errors",
  },
];
---

<Base
  title={isVi ? "Gia Tinh" : "House-Elves"}
  description={isVi ? "Các tác tử AI gắn với nhiệm vụ cụ thể" : "AI agents bound to specific duties"}
  breadcrumbs={[
    { label: "Room of Requirement", href: "/room-of-requirement" },
    { label: isVi ? "Gia Tinh" : "House-Elves" },
  ]}
>
  <section class="he-page">
    <div class="he-inner">
      <h1 class="he-title">{isVi ? "Gia Tinh" : "House-Elves"}</h1>
      <p class="he-desc">
        {isVi
          ? "Các gia tinh trung thành, mỗi vị gắn với một nhiệm vụ."
          : "Loyal house-elves, each bound to a specific duty."}
      </p>
      <p class="he-count">{agents.length} {isVi ? "tác tử" : "agents"}</p>
      <div class="he-list">
        {agents.map((a) => (
          <div class="he-card">
            <span class="he-name">{a.name}</span>
            <span class="he-purpose">{a.purpose}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
</Base>

<style>
  .he-page { border-bottom: 1px solid var(--color-border); }
  .he-inner { max-width: var(--wide-width); margin: 0 auto; padding: var(--spacing-16) var(--spacing-8); }
  .he-title { font-family: var(--font-display); font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: var(--font-weight-display); letter-spacing: -0.02em; color: var(--color-text); margin: 0 0 var(--spacing-2); }
  .he-desc { font-family: var(--font-sans); font-size: var(--font-size-sm); color: var(--color-muted); margin: 0 0 var(--spacing-2); }
  .he-count { font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--color-muted); margin: 0 0 var(--spacing-8); }
  .he-list { display: flex; flex-direction: column; gap: var(--spacing-3); }
  .he-card { display: flex; flex-direction: column; gap: var(--spacing-1); padding: var(--spacing-4) var(--spacing-5); background: var(--color-surface-elevated); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .he-name { font-family: var(--font-mono); font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text); }
  .he-purpose { font-family: var(--font-sans); font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: var(--leading-relaxed); }
  @media (max-width: 600px) { .he-inner { padding: var(--spacing-10) var(--spacing-5); } }
</style>
```

- [ ] **Step 2: Build and verify**

```bash
npx astro build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/room-of-requirement/house-elves.astro
git commit -m "feat: create House-Elves dedicated sub-page"
```

---

### Task 3: Create Plugins sub-page

**Files:**
- Create: `src/pages/room-of-requirement/plugins.astro`

- [ ] **Step 1: Create the page**

Same pattern as House-Elves but with plugin data:

```astro
---
export const prerender = false;

import Base from "../../layouts/Base.astro";
import { getCurrentLang } from "../../utils/lang";

const isVi = getCurrentLang(Astro) === "vi";

const plugins = [
  {
    name: "plugin-resend",
    purpose: isVi ? "Gửi email qua Resend API + thông báo bình luận" : "Email delivery via Resend API + comment notification emails",
  },
  {
    name: "plugin-forms",
    purpose: isVi ? "Xử lý biểu mẫu (tích hợp EmDash)" : "Form handling (EmDash built-in)",
  },
  {
    name: "plugin-webhook-notifier",
    purpose: isVi ? "Thông báo webhook khi nội dung/media thay đổi" : "Webhook notifications on content/media changes",
  },
  {
    name: "plugin-pensieve-engage",
    purpose: isVi ? "Đăng ký email, gửi bản tin, theo dõi click, phân tích đọc" : "Email subscriptions, newsletter dispatch, click tracking, reading analytics",
  },
];
---

<Base
  title="Plugins"
  description={isVi ? "Các plugin EmDash mở rộng CMS" : "EmDash plugins extending the CMS"}
  breadcrumbs={[
    { label: "Room of Requirement", href: "/room-of-requirement" },
    { label: "Plugins" },
  ]}
>
  <section class="pl-page">
    <div class="pl-inner">
      <h1 class="pl-title">Plugins</h1>
      <p class="pl-desc">
        {isVi ? "Các plugin EmDash mở rộng CMS." : "EmDash plugins extending the CMS."}
      </p>
      <p class="pl-count">{plugins.length} plugins</p>
      <div class="pl-list">
        {plugins.map((p) => (
          <div class="pl-card">
            <span class="pl-name">{p.name}</span>
            <span class="pl-purpose">{p.purpose}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
</Base>

<style>
  .pl-page { border-bottom: 1px solid var(--color-border); }
  .pl-inner { max-width: var(--wide-width); margin: 0 auto; padding: var(--spacing-16) var(--spacing-8); }
  .pl-title { font-family: var(--font-display); font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: var(--font-weight-display); letter-spacing: -0.02em; color: var(--color-text); margin: 0 0 var(--spacing-2); }
  .pl-desc { font-family: var(--font-sans); font-size: var(--font-size-sm); color: var(--color-muted); margin: 0 0 var(--spacing-2); }
  .pl-count { font-family: var(--font-mono); font-size: var(--font-size-xs); color: var(--color-muted); margin: 0 0 var(--spacing-8); }
  .pl-list { display: flex; flex-direction: column; gap: var(--spacing-3); }
  .pl-card { display: flex; flex-direction: column; gap: var(--spacing-1); padding: var(--spacing-4) var(--spacing-5); background: var(--color-surface-elevated); border: 1px solid var(--color-border); border-radius: var(--radius); }
  .pl-name { font-family: var(--font-mono); font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text); }
  .pl-purpose { font-family: var(--font-sans); font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: var(--leading-relaxed); }
  @media (max-width: 600px) { .pl-inner { padding: var(--spacing-10) var(--spacing-5); } }
</style>
```

- [ ] **Step 2: Build and verify**

```bash
npx astro build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/room-of-requirement/plugins.astro
git commit -m "feat: create Plugins dedicated sub-page"
```

---

### Task 4: Update site-routes.json

**Files:**
- Modify: `src/data/site-routes.json`

- [ ] **Step 1: Add the 3 new routes**

In the `"static"` array, after the `task-observatory` entry, add:

```json
{ "path": "/room-of-requirement/restricted-section", "title": "The Restricted Section", "priority": "0.6" },
{ "path": "/room-of-requirement/house-elves", "title": "House-Elves", "priority": "0.6" },
{ "path": "/room-of-requirement/plugins", "title": "Plugins", "priority": "0.6" }
```

- [ ] **Step 2: Commit**

```bash
git add src/data/site-routes.json
git commit -m "chore: add restricted-section, house-elves, plugins to site routes"
```

---

### Task 5: Rewrite RoR index as hub dashboard

This is the big one. Replace the entire index page body (hero stays, everything else becomes a panel grid). The frontmatter data queries stay the same.

**Files:**
- Rewrite: `src/pages/room-of-requirement/index.astro`

- [ ] **Step 1: Keep the frontmatter unchanged**

The entire `---` block (lines 1–162) stays as-is. It already queries all the data we need for the summary panels (techStack, agents, plugins, taskSystems, designDocs, etc.).

- [ ] **Step 2: Replace the HTML template**

Replace everything between `---` and `<style>` with the hub dashboard layout. The hero section stays identical. Below it, replace all 6 content sections with a single dashboard grid:

```astro
<Base title="Room of Requirement" description={isVi ? "Trang web này được xây dựng như thế nào, từng phiên Claude Code" : "How this site is built, one Claude Code session at a time"} breadcrumbs={[{ label: "Room of Requirement" }]}>
  <!-- Hero: identical to current -->
  <section class="room-hero">
    <div class="room-hero-inner">
      <div class="room-rule" />
      <span class="room-label">{isVi ? "Xây Dựng" : "The Build"}</span>
      <h1 class="room-title">Room of Requirement</h1>
      <p class="room-subtitle">
        {isVi ? "Trang web này được xây dựng hoàn toàn bởi" : "This site is built entirely by"}
        {" "}
        <a href="https://claude.com/claude-code" class="cc-link">Claude Code</a>,
        {isVi
          ? " tác tử AI lập trình của Anthropic. Mọi trang, plugin, triển khai và cấu hình đều được lập trình cặp trong terminal."
          : " Anthropic's AI coding agent. Every page, plugin, deployment, and configuration was pair-programmed in the terminal."}
      </p>
      <div class="hero-links">
        <a href="/room-of-requirement/priori-incantatem" class="diary-link">
          {isVi ? "Nhật ký xây dựng" : "Build diary"} &rarr;
        </a>
        <a href="/room-of-requirement/daily-prophet" class="diary-link">
          {isVi ? "Nhật Báo Tiên Tri" : "The Daily Prophet"} &rarr;
        </a>
      </div>
    </div>
  </section>

  <!-- Dashboard Grid -->
  <section class="room-dashboard">
    <div class="dash-grid">

      <!-- Panel: What CC Does (full width, inline, Vanishing Cabinet) -->
      <div class="dash-panel dash-full" data-magic="vanish">
        <div class="dash-panel-inner">
          <div class="dash-row">
            <div class="dash-role-group">
              <span class="dash-dot" style="background: var(--color-accent);" />
              <span class="dash-role-label" style="color: var(--color-accent);">Claude Code</span>
              <span class="dash-role-count">7 {isVi ? "vai trò" : "roles"}</span>
            </div>
            <div class="dash-role-group">
              <span class="dash-dot" style="background: #3fb950;" />
              <span class="dash-role-label" style="color: #3fb950;">{isVi ? "Con Người" : "Human"}</span>
              <span class="dash-role-count">5 {isVi ? "vai trò" : "roles"}</span>
            </div>
          </div>
          <span class="dash-muted-line">{isVi ? "Mã nguồn · Hạ tầng · CI/CD · Plugin · DNS · Kiến trúc · Git" : "Source code · Infrastructure · CI/CD · Plugins · DNS · Architecture · Git"}</span>
        </div>
      </div>

      <!-- Panel: Architecture (Apparition) -->
      <div class="dash-panel" data-magic="apparition">
        <div class="dash-panel-inner">
          <span class="dash-panel-title">{isVi ? "Kiến Trúc" : "Architecture"}</span>
          <div class="dash-chips">
            {techStack.map((t) => (
              <span class="dash-chip">{t.name}</span>
            ))}
          </div>
          <span class="dash-panel-stat">{techStack.length} {isVi ? "dịch vụ" : "services"}</span>
        </div>
      </div>

      <!-- Panel: Source (Portkey) -->
      <a href="https://github.com/deathemperor/pensieve" target="_blank" rel="noopener" class="dash-panel dash-link-panel" data-magic="portkey">
        <div class="dash-panel-inner">
          <span class="dash-panel-title">{isVi ? "Mã Nguồn" : "Source"}</span>
          <div class="dash-row" style="gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="color: var(--color-text);"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            <span class="dash-mono">deathemperor/pensieve</span>
          </div>
        </div>
      </a>

      <!-- Panel: Task Observatory (Wand Trace Door) -->
      <a href="/room-of-requirement/task-observatory" class="dash-panel dash-nav-panel" data-magic="door">
        <div class="dash-panel-inner">
          <span class="dash-panel-title">{isVi ? "Đài Quan Sát" : "Task Observatory"}</span>
          <div class="dash-hp-dots">
            {taskSystems.map(sys => (
              <span class="dash-hp-dot">
                <span class="dash-dot" style={`background: ${sys.color};`} />
                <span style={`font-size: 10px; color: ${sys.color};`}>{sys.name}</span>
              </span>
            ))}
          </div>
          <span class="dash-panel-stat">
            {taskSystems.reduce((s, t) => s + t.open, 0)} {isVi ? "mở" : "open"} / {taskSystems.reduce((s, t) => s + t.done, 0)} {isVi ? "xong" : "done"} &rarr;
          </span>
        </div>
      </a>

      <!-- Panel: Restricted Section (Pensieve Dive) -->
      <a href="/room-of-requirement/restricted-section" class="dash-panel dash-nav-panel" data-magic="pensieve">
        <div class="dash-panel-inner">
          <span class="dash-panel-title">{isVi ? "Khu Cấm" : "The Restricted Section"}</span>
          <div class="dash-row" style="gap: 8px;">
            <span class="dash-badge dash-badge-spec">{totalSpecs} {isVi ? "thiết kế" : "specs"}</span>
            <span class="dash-badge dash-badge-plan">{totalPlans} {isVi ? "kế hoạch" : "plans"}</span>
          </div>
          <span class="dash-panel-stat">{docsByProject.size} {isVi ? "dự án" : "projects"} · {totalLines.toLocaleString()} {isVi ? "dòng" : "lines"} &rarr;</span>
        </div>
      </a>

      <!-- Panel: House-Elves (Patronus Burst) -->
      <a href="/room-of-requirement/house-elves" class="dash-panel dash-nav-panel" data-magic="patronus">
        <div class="dash-panel-inner">
          <span class="dash-panel-title">{isVi ? "Gia Tinh" : "House-Elves"}</span>
          <span class="dash-name-list">{agents.map(a => a.name).join(" · ")}</span>
          <span class="dash-panel-stat">{agents.length} {isVi ? "tác tử" : "agents"} &rarr;</span>
        </div>
      </a>

      <!-- Panel: Plugins (Floo Network) -->
      <a href="/room-of-requirement/plugins" class="dash-panel dash-nav-panel" data-magic="floo">
        <div class="dash-panel-inner">
          <span class="dash-panel-title">Plugins</span>
          <span class="dash-name-list">{plugins.map(p => p.name.replace('plugin-', '')).join(" · ")}</span>
          <span class="dash-panel-stat">{plugins.length} plugins &rarr;</span>
        </div>
      </a>

    </div>
  </section>
</Base>
```

- [ ] **Step 3: Replace the `<style>` block**

Remove all old section styles (.room-section, .room-inner, .two-col, .tech-grid, .tech-card, .agent-list, .agent-card, .rs-*, etc.) and replace with dashboard styles:

```css
<style>
  /* Hero — kept from original */
  .room-hero { position: relative; border-bottom: 1px solid var(--color-border); }
  .room-hero-inner { max-width: var(--wide-width); margin: 0 auto; padding: var(--spacing-24) var(--spacing-8) var(--spacing-20); }
  .room-rule { width: 24px; height: 1px; background: var(--color-accent); margin-bottom: var(--spacing-5); }
  .room-label { display: block; font-family: var(--font-sans); font-size: var(--font-size-xs); font-weight: 500; text-transform: uppercase; letter-spacing: var(--tracking-wider); color: var(--color-muted); margin-bottom: var(--spacing-4); }
  .room-title { font-family: var(--font-display); font-size: clamp(1.875rem, 3.5vw, 3rem); font-weight: var(--font-weight-display); line-height: 1.1; letter-spacing: -0.022em; color: var(--color-text); margin: 0 0 var(--spacing-5); }
  .room-subtitle { font-family: var(--font-sans); font-size: var(--font-size-base); line-height: var(--leading-relaxed); color: var(--color-text-secondary); max-width: 55ch; margin: 0 0 var(--spacing-6); }
  .cc-link { color: var(--color-accent); text-decoration: none; font-weight: 500; }
  .cc-link:hover { text-decoration: underline; }
  .hero-links { display: flex; gap: var(--spacing-6); }
  .diary-link { display: inline-block; font-family: var(--font-mono); font-size: var(--font-size-sm); color: var(--color-accent); text-decoration: none; transition: opacity var(--transition-fast); }
  .diary-link:hover { opacity: 0.8; }

  /* Dashboard grid */
  .room-dashboard { max-width: var(--wide-width); margin: 0 auto; padding: var(--spacing-8); }
  .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4); }

  /* Panel base */
  .dash-panel {
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    position: relative;
    /* Materialize animation */
    opacity: 0;
    animation: materialize 0.4s ease-out forwards;
  }
  .dash-panel:nth-child(1) { animation-delay: 0ms; }
  .dash-panel:nth-child(2) { animation-delay: 80ms; }
  .dash-panel:nth-child(3) { animation-delay: 160ms; }
  .dash-panel:nth-child(4) { animation-delay: 240ms; }
  .dash-panel:nth-child(5) { animation-delay: 320ms; }
  .dash-panel:nth-child(6) { animation-delay: 400ms; }
  .dash-panel:nth-child(7) { animation-delay: 480ms; }

  @keyframes materialize {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .dash-full { grid-column: 1 / -1; }
  .dash-panel-inner { padding: var(--spacing-5); display: flex; flex-direction: column; gap: var(--spacing-2); }

  /* Navigable panels */
  .dash-nav-panel, .dash-link-panel {
    text-decoration: none; color: inherit; cursor: pointer;
    transition: border-color var(--transition-fast), transform var(--transition-fast);
  }
  .dash-nav-panel:hover, .dash-link-panel:hover {
    border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-border));
    transform: translateY(-1px);
  }

  /* Shimmer border on navigable panels */
  .dash-nav-panel::before {
    content: ''; position: absolute; inset: -1px; border-radius: var(--radius-lg);
    background: conic-gradient(from 0deg, #58a6ff, #7c3aed, #d4a843, #58a6ff);
    opacity: 0; transition: opacity 0.3s; z-index: -1;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude; -webkit-mask-composite: xor;
    padding: 1px;
  }
  .dash-nav-panel:hover::before { opacity: 0.4; }

  /* Panel elements */
  .dash-panel-title { font-family: var(--font-display); font-size: var(--font-size-base); font-weight: var(--font-weight-display); color: var(--color-text); }
  .dash-panel-stat { font-family: var(--font-mono); font-size: 10px; color: var(--color-muted); margin-top: var(--spacing-1); }
  .dash-row { display: flex; align-items: center; gap: var(--spacing-4); }
  .dash-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
  .dash-role-group { display: flex; align-items: center; gap: 4px; }
  .dash-role-label { font-size: 11px; font-weight: 600; }
  .dash-role-count { font-size: 11px; color: var(--color-muted); }
  .dash-muted-line { font-size: 10px; color: var(--color-muted); font-family: var(--font-mono); }
  .dash-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .dash-chip { font-size: 10px; padding: 2px 8px; background: color-mix(in srgb, var(--color-border) 50%, transparent); border-radius: 4px; color: var(--color-text-secondary); font-family: var(--font-mono); }
  .dash-mono { font-family: var(--font-mono); font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text); }
  .dash-hp-dots { display: flex; gap: 8px; flex-wrap: wrap; }
  .dash-hp-dot { display: flex; align-items: center; gap: 4px; }
  .dash-name-list { font-size: 10px; color: var(--color-text-secondary); line-height: var(--leading-relaxed); }
  .dash-badge { font-family: var(--font-mono); font-size: 10px; padding: 1px 6px; border-radius: 3px; }
  .dash-badge-spec { color: #7c3aed; background: color-mix(in srgb, #7c3aed 12%, transparent); }
  .dash-badge-plan { color: #d4a843; background: color-mix(in srgb, #d4a843 12%, transparent); }

  /* Responsive */
  @media (max-width: 600px) {
    .room-hero-inner { padding: var(--spacing-12) var(--spacing-5); }
    .room-dashboard { padding: var(--spacing-5); }
    .dash-grid { grid-template-columns: 1fr; }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .dash-panel { animation: none; opacity: 1; }
    .dash-nav-panel::before { display: none; }
  }
</style>
```

- [ ] **Step 4: Build and verify**

```bash
npx astro build 2>&1 | tail -5
```

Expected: `Build complete!` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/room-of-requirement/index.astro
git commit -m "feat: rewrite RoR index as compact hub dashboard

7 summary panels in a 2-column grid. Staggered materialize on load,
shimmer border on hover for navigable panels. Growing sections link
to dedicated sub-pages."
```

---

### Task 6: Add per-panel HP-themed click animations

Add the View Transitions API integration and per-panel magical click animations as a `<script>` block in the index page.

**Files:**
- Modify: `src/pages/room-of-requirement/index.astro`

- [ ] **Step 1: Add animation CSS keyframes**

Append these keyframes inside the existing `<style>` block, before the responsive media queries:

```css
  /* ── Magic: Wand Trace Door (Task Observatory) ── */
  @keyframes doorTrace {
    to { stroke-dashoffset: 0; }
  }

  /* ── Magic: Pensieve Dive (Restricted Section) ── */
  @keyframes pensieveDive {
    0% { transform: scale(1); border-color: var(--color-border); }
    15% { transform: scale(1.03); border-color: #58a6ff; box-shadow: 0 0 24px rgba(88,166,255,0.25); }
    35% { transform: scale(1.03); }
    55% { transform: scale(0.92) translateY(6px); }
    75% { transform: scale(0.3) translateY(24px); opacity: 0.3; filter: blur(3px); }
    100% { transform: scale(0) translateY(50px); opacity: 0; filter: blur(10px); }
  }

  /* ── Magic: Floo Network (Plugins) ── */
  @keyframes flooBurn {
    0% { border-color: var(--color-border); }
    10% { border-color: #3fb950; box-shadow: 0 0 8px rgba(63,185,80,0.2); }
    30% { box-shadow: 0 0 30px rgba(63,185,80,0.4), inset 0 -30px 30px rgba(63,185,80,0.15); }
    60% { box-shadow: 0 0 50px rgba(63,185,80,0.3), inset 0 -60px 40px rgba(63,185,80,0.25); transform: scale(1.02); }
    80% { opacity: 0.5; transform: scale(0.98) translateY(-8px); filter: blur(2px); }
    100% { opacity: 0; transform: scale(0.9) translateY(-30px); filter: blur(6px); }
  }

  /* ── Magic: Patronus Burst (House-Elves) ── */
  @keyframes patronusBurst {
    0% { border-color: var(--color-border); }
    15% { border-color: rgba(200,220,255,0.6); box-shadow: 0 0 12px rgba(200,220,255,0.2); }
    30% { box-shadow: 0 0 40px rgba(200,220,255,0.4), inset 0 0 30px rgba(200,220,255,0.1); transform: scale(1.02); }
    50% { box-shadow: 0 0 80px rgba(200,220,255,0.5); }
    70% { opacity: 0.6; transform: scale(1.05); filter: blur(1px); }
    100% { opacity: 0; filter: blur(8px); transform: scale(1.2); }
  }

  /* ── Magic: Apparition (Architecture) ── */
  @keyframes apparate {
    0% { transform: scale(1, 1); }
    20% { transform: scale(1.02, 0.98); }
    40% { transform: scale(0.3, 1.8); opacity: 0.7; filter: blur(2px); }
    60% { transform: scale(0.1, 2.5); opacity: 0.4; filter: blur(4px); }
    100% { transform: scale(0, 4); opacity: 0; filter: blur(8px); }
  }

  /* ── Magic: Portkey (Source) ── */
  @keyframes portkeyPull {
    0% { transform: rotate(0deg) scale(1); border-color: var(--color-border); }
    15% { border-color: #d4a843; box-shadow: 0 0 12px rgba(212,168,67,0.3); }
    30% { transform: rotate(2deg) scale(1.01); }
    50% { transform: rotate(-1deg) scale(1.02); }
    65% { transform: rotate(3deg) scale(0.95); }
    100% { transform: rotate(720deg) scale(0); opacity: 0; filter: blur(6px); }
  }

  /* ── Magic: Vanishing Cabinet (What CC Does) ── */
  @keyframes vanishPhase {
    0% { opacity: 1; } 10% { opacity: 0.3; } 20% { opacity: 0.9; }
    30% { opacity: 0.2; } 40% { opacity: 0.8; } 50% { opacity: 0.1; }
    60% { opacity: 0.6; } 70% { opacity: 0.05; filter: blur(1px); }
    80% { opacity: 0.4; } 90% { opacity: 0.02; filter: blur(3px); }
    100% { opacity: 0; filter: blur(4px); transform: scale(0.98); }
  }

  /* Particles */
  .magic-ripple {
    position: absolute; border-radius: 50%; pointer-events: none;
    border: 1px solid rgba(88,166,255,0.25);
    animation: rippleExpand 1.2s ease-out forwards;
  }
  @keyframes rippleExpand {
    0% { width: 20px; height: 20px; opacity: 0.7; transform: translate(-50%, -50%); }
    100% { width: 300px; height: 300px; opacity: 0; transform: translate(-50%, -50%); }
  }

  .magic-flame {
    position: absolute; width: 6px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    background: #3fb950; pointer-events: none; filter: blur(1px);
    animation: flameRise 0.8s ease-out forwards;
  }
  @keyframes flameRise {
    0% { opacity: 0.8; transform: translateY(0) scale(1); }
    100% { opacity: 0; transform: translateY(-60px) scale(0.3); }
  }

  .magic-ray {
    position: absolute; height: 1px; transform-origin: left center; pointer-events: none;
    background: linear-gradient(90deg, rgba(200,220,255,0.6), transparent);
    animation: rayShoot 0.7s ease-out forwards;
  }
  @keyframes rayShoot { 0% { opacity: 0.8; width: 0; } 100% { opacity: 0; width: 150px; } }

  .magic-crack {
    position: absolute; width: 4px; height: 4px; border-radius: 50%; background: white; pointer-events: none;
    animation: crackFlash 0.3s ease-out forwards;
  }
  @keyframes crackFlash {
    0% { opacity: 1; transform: translate(-50%,-50%) scale(1); box-shadow: 0 0 20px rgba(255,255,255,0.8); }
    100% { opacity: 0; transform: translate(-50%,-50%) scale(8); }
  }
```

- [ ] **Step 2: Add the `<script>` block for click handlers**

Add this after the closing `</style>` tag:

```html
<script>
  // Magic click transitions with View Transitions API fallback
  const animations = {
    door: (el) => { el.style.animation = 'none'; el.style.perspective = '800px'; el.style.transformOrigin = 'left center'; el.offsetHeight; el.style.animation = 'doorTrace 0.7s ease-out forwards'; setTimeout(() => { el.style.transition = 'transform 0.8s cubic-bezier(0.32,0,0.15,1)'; el.style.transform = 'perspective(800px) rotateY(-105deg)'; }, 700); },
    pensieve: (el, stage) => { el.style.animation = 'pensieveDive 1.2s cubic-bezier(0.4,0,0.2,1) forwards'; for (let i = 0; i < 3; i++) setTimeout(() => { const r = document.createElement('div'); r.className = 'magic-ripple'; r.style.left = '50%'; r.style.top = '50%'; stage.appendChild(r); setTimeout(() => r.remove(), 1200); }, i * 250 + 300); },
    floo: (el, stage) => { el.style.animation = 'flooBurn 1s ease-in forwards'; for (let i = 0; i < 10; i++) setTimeout(() => { const f = document.createElement('div'); f.className = 'magic-flame'; f.style.left = (30 + Math.random() * 40) + '%'; f.style.bottom = '20%'; f.style.height = (8 + Math.random() * 12) + 'px'; stage.appendChild(f); setTimeout(() => f.remove(), 800); }, i * 60 + 100); },
    patronus: (el, stage) => { el.style.animation = 'patronusBurst 1.3s ease-out forwards'; for (let i = 0; i < 8; i++) setTimeout(() => { const r = document.createElement('div'); r.className = 'magic-ray'; r.style.left = '50%'; r.style.top = '50%'; r.style.transform = `rotate(${i * 45}deg)`; stage.appendChild(r); setTimeout(() => r.remove(), 700); }, 400 + i * 30); },
    apparition: (el, stage) => { el.style.animation = 'apparate 0.9s cubic-bezier(0.4,0,0.2,1) forwards'; setTimeout(() => { const c = document.createElement('div'); c.className = 'magic-crack'; c.style.left = '50%'; c.style.top = '50%'; stage.appendChild(c); setTimeout(() => c.remove(), 400); }, 500); },
    portkey: (el) => { el.style.animation = 'portkeyPull 1s cubic-bezier(0.4,0,0.2,1) forwards'; },
    vanish: (el) => { el.style.animation = 'vanishPhase 1.2s ease-in-out forwards'; },
  };

  document.querySelectorAll('[data-magic]').forEach(panel => {
    const magic = panel.dataset.magic;
    const href = panel.getAttribute('href');
    if (!href || !animations[magic]) return;

    panel.addEventListener('click', (e) => {
      // Skip if reduced motion preferred
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      e.preventDefault();
      const animate = animations[magic];
      animate(panel, panel.parentElement);

      // Navigate after animation
      const delay = magic === 'pensieve' ? 1200 : magic === 'patronus' ? 1300 : magic === 'vanish' ? 1200 : 1000;
      setTimeout(() => {
        if (document.startViewTransition) {
          document.startViewTransition(() => { window.location.href = href; });
        } else {
          window.location.href = href;
        }
      }, delay);
    });
  });
</script>
```

- [ ] **Step 3: Build and verify**

```bash
npx astro build 2>&1 | tail -5
```

Expected: `Build complete!`

- [ ] **Step 4: Commit**

```bash
git add src/pages/room-of-requirement/index.astro
git commit -m "feat: add 7 HP-themed click animations to dashboard panels

Wand Trace Door, Pensieve Dive, Floo Network, Patronus Burst,
Apparition, Portkey, Vanishing Cabinet — one per panel. CSS keyframes
+ View Transitions API with prefers-reduced-motion fallback."
```

---

### Task 7: Deploy and verify

- [ ] **Step 1: Merge to main**

```bash
cd /Users/deathemperor/death/pensieve
git merge worktree-Ron --no-edit
```

- [ ] **Step 2: Push to deploy**

```bash
git push origin main
```

- [ ] **Step 3: Verify deployment**

```bash
gh run list --limit 1
```

Wait for `completed success`, then verify at `https://huuloc.com/room-of-requirement/`:
- Dashboard grid loads with staggered materialize
- Navigable panels shimmer on hover
- Each panel plays its HP animation on click before navigating
- Sub-pages load correctly: `/restricted-section`, `/house-elves`, `/plugins`
- Mobile layout stacks to single column
