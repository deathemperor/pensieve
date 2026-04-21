# Trương About Page — Mage Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/Trương` with (1) refreshed facts from the corpus, (2) a new Community section, (3) aesthetic consolidation around the Architect-Mage + Scholar-Wizard archetype (27 effects cut, 7 new effects added).

**Architecture:** Single-file edit on `src/pages/Trương.astro`. All effects are SVG + CSS keyframes (same pattern as the existing 62 effects — no new dependencies). Live GitHub numbers already flow through the page's `ghUser` object + the GraphQL block at `~line 86`; the plan extends that to two more strings. Content for the expanded narrative is pulled verbatim from `seed/seed.json` posts (exact line citations in each task).

**Tech Stack:** Astro 5 (SSR, `output: "server"`), TypeScript, SVG, CSS, GitHub REST + GraphQL. No test framework for visual effects — browser verification is the signal.

**Spec reference:** `docs/superpowers/specs/2026-04-21-truong-about-mage-upgrade-design.md`

**Working tree:** main branch, direct commits (matches the project's recent-history style; no feature branch needed — changes are isolated to one page).

---

## Pre-flight

### Task 0: Dev server up and baseline screenshot

**Files:** none (environment only)

- [ ] **Step 1: Start the dev server.**

```bash
npx emdash dev
```

Expected: server comes up on `http://localhost:4321`. Wait for "watching for file changes".

- [ ] **Step 2: Open `/Trương` in browser, confirm page renders, note current state.**

Open http://localhost:4321/Tr%C6%B0%C6%A1ng (the URL-encoded form of `/Trương`). Expected:
- Hero renders with "CTO / COO · Full-Stack Engineer"
- Current subtitle "Engineer. Writer. Fishkeeper."
- GitHub meta row says "Since 2013 · 44 public repos · shipping 37+ AI agents"
- Portrait is cluttered with ~62 effects
- GitHub Activity section renders (coding eras, day-of-week, repos, feed)

- [ ] **Step 3: Git sanity check.**

```bash
git status && git log --oneline -3
```

Expected: clean working tree on `main`, HEAD is `6364fb67` (spec addendum) or newer.

---

## Phase A — Content refresh (5 tasks)

### Task A1: New 8-role subtitle

**Files:**
- Modify: `src/pages/Trương.astro` (lines 212–214, the `<p class="about-subtitle">` block)

- [ ] **Step 1: Replace the subtitle copy.**

Find this in `Trương.astro`:

```astro
<p class="about-subtitle">
    {isVi ? "Kỹ sư. Nhà văn. Người nuôi cá." : "Engineer. Writer. Fishkeeper."}
</p>
```

Replace with:

```astro
<p class="about-subtitle">
    {isVi
        ? "Giáo viên · Kỹ sư · Cha · Người phục vụ · Nhà văn · Người nuôi cá · Nhà truyền bá công nghệ · Nhà thám hiểm."
        : "Teacher · Engineer · Father · Servant · Writer · Fishkeeper · Tech Evangelist · Explorer."}
</p>
```

- [ ] **Step 2: Verify CSS allows it to wrap gracefully.**

Grep for the current subtitle style:

```bash
grep -n '\.about-subtitle' src/pages/Trương.astro
```

Confirm `.about-subtitle` has `max-width` or `text-wrap: balance` or similar. If the string overflows on narrow viewports, add `text-wrap: pretty;` to `.about-subtitle`.

- [ ] **Step 3: Visual verification.**

Reload `/Trương` in browser. Expected:
- Subtitle shows the 8 roles middle-dot-separated in English
- Language toggle shows the VI variant
- Wraps cleanly at mobile width (resize window to ~400px)

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): 8-role subtitle (Teacher · Engineer · Father · …)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task A2: Live-compute hero GitHub row ("Since … · N repos · ∞ AI agents")

**Files:**
- Modify: `src/pages/Trương.astro` (lines 228–231, the "Trên GitHub / GitHub" meta row)

- [ ] **Step 1: Replace the hardcoded meta value with live data from `ghUser`.**

Find:

```astro
<div class="about-meta-row">
    <dt>{isVi ? "Trên GitHub" : "GitHub"}</dt>
    <dd>{isVi ? "Từ 2013 · 44 kho mã công khai · đang xây 37+ AI agent" : "Since 2013 · 44 public repos · shipping 37+ AI agents"}</dd>
</div>
```

Replace with:

```astro
<div class="about-meta-row">
    <dt>{isVi ? "Trên GitHub" : "GitHub"}</dt>
    <dd>
        {ghUser ? (
            isVi
                ? `Từ ${new Date(ghUser.created_at).getFullYear()} · ${ghUser.public_repos + (ghUser.owned_private_repos ?? 0)} kho mã · ∞ AI agent`
                : `Since ${new Date(ghUser.created_at).getFullYear()} · ${ghUser.public_repos + (ghUser.owned_private_repos ?? 0)} repos · ∞ AI agents`
        ) : (
            isVi ? "Từ 2013 · ∞ AI agent" : "Since 2013 · ∞ AI agents"
        )}
    </dd>
</div>
```

The `ghUser` object and `isVi` are already in scope (see lines 9 and 47).

- [ ] **Step 2: Visual verification.**

Reload `/Trương`. Expected:
- EN: "Since 2013 · N repos · ∞ AI agents" (N is a real number, probably 44–50)
- VI: "Từ 2013 · N kho mã · ∞ AI agent"
- If GitHub API is down (disconnect Wi-Fi briefly, reload), falls back to "Since 2013 · ∞ AI agents"

- [ ] **Step 3: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): live-compute hero GitHub row, ∞ agents

Repo count now reads from ghUser (same source the activity section
uses); the agent count becomes ∞ — no hand-typed number to rot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task A3: Expand VNG narrative paragraph

**Files:**
- Modify: `src/pages/Trương.astro` (the narrative section starting ~line 946, specifically the VinaGame paragraph inside both the `isVi` and EN blocks; lines ~955–958 in VI and ~987–991 in EN)

**Source of truth:** `seed/seed.json:1965` (VI) and `seed/seed.json:2023` (EN) — verbatim Facebook post content. Do not paraphrase; lightly adapt to third-person prose voice already on the page.

- [ ] **Step 1: Replace the VI VinaGame paragraph.**

Find:

```astro
<p>
    Tôi gia nhập VinaGame (nay là VNG) tháng 12 năm 2006, nơi tôi phát minh ra cơ chế
    quản lý session chạy production nhiều năm. Đó là khởi đầu của hai thập kỷ xây dựng
    trong ngành công nghệ Việt Nam — từ hạ tầng game đến startup đến AI.
</p>
```

Replace with:

```astro
<p>
    Tôi gia nhập VinaGame (nay là VNG) ngày 19 tháng 12 năm 2006. Năm 2007, tôi
    phát minh cơ chế session management đẩy sự kiện out-of-game lớn nhất của
    <em>Võ Lâm Truyền Kỳ</em> lên hàng nghìn người cùng online. Năm 2008, đồng
    thiết kế hệ thống Passport — 200 nghìn lượt đăng ký mỗi tháng. Năm 2009,
    định nghĩa và kiến trúc hệ thống <strong>Single Sign-On đầu tiên của Việt
    Nam</strong>, đẩy tốc độ phát hành game lên 10+ tựa mỗi tháng. Rồi chỉ huy
    đợt tích hợp nhanh nhất từng có cho Gunny, cùng đội hồi sinh game từ ~1k
    lên 100k+ người cùng online, doanh thu từ vài triệu lên hơn 30 tỷ mỗi
    tháng — góp phần đánh bật dòng game cạnh tranh của FPT Games.
</p>
```

- [ ] **Step 2: Replace the EN VinaGame paragraph.**

Find:

```astro
<p>
    I joined VinaGame (now VNG) in December 2006, where I invented a session
    management mechanism that ran in production for years. That was the start
    of two decades of building things in Vietnam's tech scene — from gaming
    infrastructure to startups to AI.
</p>
```

Replace with:

```astro
<p>
    I joined VinaGame (now VNG) on December 19th, 2006. In 2007, I invented
    the session-management mechanism that scaled <em>Võ Lâm Truyền Kỳ</em>'s
    biggest out-of-game event to thousands of concurrent users. In 2008, I
    co-designed the Passport system — 200k monthly registrations. In 2009, I
    defined, designed, and architected <strong>Vietnam's first Single Sign-On
    web system</strong>, pushing game-publishing agility to 10+ launches a
    month. Then I led the fastest-ever integration for Gunny, and the team
    that revived the game from ~1k concurrent users and a few million in
    monthly revenue to 100k+ and 30B+ VND — helping kill FPT Games'
    competing line.
</p>
```

- [ ] **Step 3: Visual verification.**

Reload `/Trương`. Expected:
- Both language variants render the expanded paragraph
- `<em>` italicizes *Võ Lâm Truyền Kỳ*
- `<strong>` bolds the SSO claim

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): expand VNG paragraph to credit four inventions

Source: seed.json:2023 (EN) and seed.json:1965 (VI) — Facebook post
\"Joined VinaGame in December 2006\". Adds Passport (2008), VN-first
SSO (2009), and the Gunny revival alongside the existing session
management credit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task A4: Add Papaya/Oasis paragraph

**Files:**
- Modify: `src/pages/Trương.astro` (insert a new `<p>` into both the VI and EN narrative blocks, after the VNG paragraph, before the fishkeeping paragraph)

**Source of truth:** `seed/seed.json:3996`.

- [ ] **Step 1: Insert the VI paragraph.**

In the `isVi` branch of the narrative, directly after the VNG paragraph (ends with "…FPT Games."), and before "Tôi nuôi cá…", add:

```astro
<p>
    Giờ tôi ở <strong>Papaya</strong>, xây một giấc mơ tên <em>Oasis</em> —
    nền tảng cung cấp AI Agent cho đối tác, như Service-As-A-Software (không
    phải đánh máy lộn, đây là thời SaaS mới). Các Agent sinh ra với một tâm
    hồn, truyền từ cái tâm của người làm: mang giá trị cho khách hàng.
</p>
```

- [ ] **Step 2: Insert the EN paragraph.**

Same position in the EN branch:

```astro
<p>
    Now I'm at <strong>Papaya</strong>, building a dream called
    <em>Oasis</em> — a platform that delivers AI Agents to partners as
    Service-As-A-Software (not a typo; this is the new age of SaaS). Every
    Agent is born with a soul, passed down from the heart of the person who
    makes them: to bring value to the customer.
</p>
```

- [ ] **Step 3: Visual verification.**

Reload `/Trương`. Expected: a fourth paragraph appears in the narrative for both languages, between the VNG credits and the cichlid paragraph.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): add Papaya/Oasis paragraph — current chapter

Source: seed.json:3996. Introduces Oasis (the Papaya AI-agent platform
as Service-As-A-Software) so the narrative reaches the present tense.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task A5: Live Claude Code era commit count

**Files:**
- Modify: `src/pages/Trương.astro` (frontmatter, lines ~85–107 — extend the existing GraphQL block with a second query scoped to the Claude Code era start; and line ~1087 where `232 commit` is rendered)

- [ ] **Step 1: Extend the frontmatter GraphQL block with an era-scoped count.**

Near the existing GraphQL fetch (line ~87), locate:

```ts
if (ghToken) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    fetches.push(
        fetch("https://api.github.com/graphql", {
```

Extend the GraphQL query so a single request returns both the rolling-30-day count *and* the era count. Replace the `query` string with:

```ts
query: `{
    viewer {
        last30: contributionsCollection(from: "${since}") {
            totalCommitContributions
            restrictedContributionsCount
        }
        claudeEra: contributionsCollection(from: "2026-01-29T00:00:00Z") {
            totalCommitContributions
            restrictedContributionsCount
        }
    }
}`,
```

Then after the `gql` parse (around line 105), add:

```ts
let claudeEraCommitCount = 232; // fallback if GraphQL unavailable or rate-limited
if (results[3]?.ok) {
    const gql = await results[3].json();
    const last30 = gql?.data?.viewer?.last30;
    const era = gql?.data?.viewer?.claudeEra;
    recentCommitCount = (last30?.totalCommitContributions ?? 0) + (last30?.restrictedContributionsCount ?? 0);
    const eraTotal = (era?.totalCommitContributions ?? 0) + (era?.restrictedContributionsCount ?? 0);
    if (eraTotal > 0) claudeEraCommitCount = eraTotal;
}
```

Remove the old single-count parse block that this replaces (previous code did `const cc = gql?.data?.viewer?.contributionsCollection; recentCommitCount = …`).

- [ ] **Step 2: Render the live count in the eras timeline.**

Find (around line 1087):

```astro
<span class="era-commits">232 commit{isVi ? "" : "s"}</span>
```

Replace with:

```astro
<span class="era-commits">{isVi ? `${claudeEraCommitCount.toLocaleString("vi-VN")} commit` : `${claudeEraCommitCount.toLocaleString("en-US")} commit${claudeEraCommitCount !== 1 ? "s" : ""}`}</span>
```

- [ ] **Step 3: Visual verification.**

Reload `/Trương`. Expected:
- Claude Code era shows a number larger than 232 (since the era started Jan 29, today is Apr 21, ~3 months of commits)
- Number formatted with thousand separator if ≥1000
- If GitHub token absent / rate-limited, falls back to `232`

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): live Claude Code era commit count via GraphQL

Scopes a second contributionsCollection query to 2026-01-29 (era start)
so the \"232 commits\" number stops being a stale hand-typed value.
Falls back to 232 on API failure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

## Phase B — Community section (1 task)

### Task B1: Add Community section above narrative

**Files:**
- Modify: `src/pages/Trương.astro` (insert a new `<section>` between the close of `.about-hero` at line ~944 and the narrative `<section class="about-section">` at line 946)
- Modify: `src/pages/Trương.astro` (CSS `<style>` block, add `.community-grid` and `.community-card` rules — can piggy-back on existing `.repo-card` styles)

- [ ] **Step 1: Insert the Community `<section>` markup.**

Directly after `</section>` (line ~944, closing `.about-hero`), before `<section class="about-section">` (line 946), insert:

```astro
<section class="about-section">
    <div class="about-inner">
        <h2 class="section-heading">{isVi ? "Cộng Đồng" : "Community"}</h2>
        <p class="section-desc">
            {isVi
                ? "Nơi tôi đã làm và vẫn đang làm — bút danh deathemperor trên khắp các diễn đàn Việt Nam từ đầu những năm 2000."
                : "Where I've been, and where I still am — as deathemperor across Vietnamese forums since the early 2000s."}
        </p>
        <div class="community-grid">
            <a href="https://gamevn.com" class="community-card" target="_blank" rel="noopener">
                <span class="community-name">gamevn.com</span>
                <span class="community-role">{isVi ? "Thành viên từ 2002" : "Member since 2002"}</span>
                <span class="community-desc">
                    {isVi
                        ? "Diễn đàn game lớn nhất Việt Nam. Những thread đầu tay viết về Sim City 4, KOTOR, và cả thập niên console-PC của những năm 2000."
                        : "Vietnam's biggest gaming forum. Earliest threads cover Sim City 4, KOTOR, and the whole 2000s console-PC era."}
                </span>
            </a>
            <a href="https://www.vbulletin.org/forum/" class="community-card" target="_blank" rel="noopener">
                <span class="community-name">vBulletin.org</span>
                <span class="community-role">{isVi ? "Cộng tác viên" : "Contributor"}</span>
                <span class="community-desc">
                    {isVi
                        ? "Tham gia tích cực trong cộng đồng phần mềm diễn đàn — nơi hàng ngàn diễn đàn Việt Nam ngày ấy chạy trên đó."
                        : "Active in the forum-software community — the platform that powered a thousand Vietnamese forums back in the day."}
                </span>
            </a>
            <a href="/hol" class="community-card">
                <span class="community-name">holvn.org (HOL)</span>
                <span class="community-role">{isVi ? "Đang dựng lại" : "Rebuilding now"}</span>
                <span class="community-desc">
                    {isVi
                        ? "Diễn đàn vBulletin Việt Nam đã đóng cửa — tôi đang dựng lại bản đọc từ snapshot Wayback Machine, sống tại /hol trên trang này."
                        : "A defunct Vietnamese vBulletin forum — reconstructing a read-only archive from Wayback Machine snapshots, live at /hol on this site."}
                </span>
            </a>
            <a href="https://facebook.com/groups/romy" class="community-card" target="_blank" rel="noopener">
                <span class="community-name">{isVi ? "Rô Mỹ (Cá Rô Trung Mỹ Việt Nam)" : "Rô Mỹ (American Cichlids Vietnam)"}</span>
                <span class="community-role">{isVi ? "Admin trưởng" : "Head admin"}</span>
                <span class="community-desc">
                    {isVi
                        ? "Nhóm Facebook cộng đồng chơi cá rô Mỹ ở Việt Nam — dẫn dắt đội quản trị qua một lần thay máu năm 2021."
                        : "Facebook community for American cichlid keepers in Vietnam — led the admin-team evolution in 2021."}
                </span>
            </a>
        </div>
    </div>
</section>
```

**Important:** The `/hol` link does *not* have `target="_blank"` — it's an in-site route. The three external links do.

- [ ] **Step 2: Add the CSS for `.community-grid` and `.community-card`.**

Find the `.repos-grid` and `.repo-card` rules in the `<style>` block (grep for `.repo-card`). Directly after those rules, append:

```css
.community-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
}

.community-card {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 1rem;
    border: 1px solid var(--color-border, rgba(240, 199, 94, 0.2));
    border-radius: 0.5rem;
    background: rgba(240, 199, 94, 0.03);
    color: inherit;
    text-decoration: none;
    transition: border-color 200ms, background 200ms, transform 200ms;
}

.community-card:hover {
    border-color: rgba(240, 199, 94, 0.55);
    background: rgba(240, 199, 94, 0.06);
    transform: translateY(-1px);
}

.community-name {
    font-family: var(--font-display, "Inter Tight", sans-serif);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--color-accent, #f0c75e);
}

.community-role {
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-muted, rgba(255, 255, 255, 0.55));
}

.community-desc {
    font-size: 0.9rem;
    line-height: 1.45;
    color: var(--color-text-dim, rgba(255, 255, 255, 0.75));
}
```

(Token names like `--color-border`, `--color-accent` may not exist; fall back values are provided. If the existing Pensieve theme uses different variable names — check `src/styles/` or the `Base.astro` theme tokens — substitute those.)

- [ ] **Step 3: Visual verification.**

Reload `/Trương`. Expected:
- Community section appears *directly below the hero*, *above* the narrative prose
- 4 cards in a responsive grid (1 col on mobile, 2 on tablet, 3–4 on desktop)
- gamevn, vBulletin, Rô Mỹ links open in new tab; `/hol` opens in same tab
- Hover on card → subtle border + background lift

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): add Community section above narrative

Four cards (gamevn.com, vBulletin.org, holvn.org/HOL, Rô Mỹ FB group)
as part of the origin story rather than a footer-adjacent block. The
/hol link stays in-tab; external forums open in a new tab.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

## Phase C — Cuts (27 effects, batched into 4 commits)

Each cut = delete the HTML block *and* its CSS rules. To find the CSS, grep for the class name with a leading `.` — e.g. `grep -n '\.portrait-web' src/pages/Trương.astro`. Delete every matching rule, including `@keyframes` that are *only* referenced by the cut class.

**Checklist for every cut:**
1. Delete the HTML block (search by the `class="portrait-xxx"` landmark)
2. Delete the corresponding CSS rules (`.portrait-xxx`, any child selectors, any `@keyframes` keyed only to this class)
3. Do **not** touch `.portrait-card`, `.portrait-filters`, `.portrait-vignette`, `.portrait-edge-glow`, `.portrait-trace` — those are structural

### Task C1: Cut photography motifs (6)

**Files:** `src/pages/Trương.astro` (both HTML and `<style>` sections)

Effects to remove:
- `portrait-web` (dreamcatcher / spider web — though not strictly "photography", cutting with this batch because it's the outermost layer)
- `portrait-chromatic` (chromatic aberration R/B ghosts)
- `portrait-diffraction` (rainbow diffraction sweep)
- `portrait-clock` (sweeping clock hands)
- `portrait-aperture` (camera iris)
- `portrait-negative-flash` (photo negative flash)
- `portrait-lens-flare` (lens flare + rings)

- [ ] **Step 1: Delete HTML blocks for each class.**

For each class above, locate `<svg class="portrait-X"` or `<div class="portrait-X"` in `Trương.astro` (lines ~234–373 range) and delete from the opening tag through the matching closing tag. Include surrounding `{/* … */}` comment if present.

- [ ] **Step 2: Delete CSS rules for each class.**

```bash
grep -nE '\.portrait-(web|chromatic|diffraction|clock|aperture|negative-flash|lens-flare)\b' src/pages/Trương.astro
```

Delete every rule line (and its body) that references these classes. Also check for `@keyframes` names that only these effects use (e.g. `@keyframes lens-flare-spin`) — if no other class references them, delete too.

- [ ] **Step 3: Build check — make sure the file still compiles.**

The dev server should hot-reload. Watch the terminal for TS/Astro errors. If any, fix before committing.

- [ ] **Step 4: Visual verification.**

Reload `/Trương`. Expected: portrait still renders; 7 fewer effects; no console errors (open devtools → Console tab).

- [ ] **Step 5: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "refactor(truong): cut 7 photography/dreamcatcher effects

Remove portrait-web, portrait-chromatic, portrait-diffraction,
portrait-clock, portrait-aperture, portrait-negative-flash,
portrait-lens-flare — all photography motifs that fight the
mage aesthetic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task C2: Cut pop/retro/CRT motifs (3)

**Files:** `src/pages/Trương.astro`

Effects to remove:
- `portrait-sunburst` (retro sunburst rays)
- `portrait-halftone` (halftone dot pattern)
- `portrait-scan-lines` (CRT scan lines)

- [ ] **Step 1: Delete HTML + CSS + keyframes (same procedure as Task C1).**

```bash
grep -nE '\.portrait-(sunburst|halftone|scan-lines)\b' src/pages/Trương.astro
```

- [ ] **Step 2: Visual verification.**

Reload `/Trương`. Expected: portrait loses the dotted/striped overlays and the retro ray pattern.

- [ ] **Step 3: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "refactor(truong): cut 3 pop/CRT motifs (sunburst, halftone, scan-lines)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task C3: Cut off-register decorative motifs (10)

**Files:** `src/pages/Trương.astro`

Effects to remove:
- `portrait-zodiac`
- `portrait-stained-glass`
- `portrait-mercury`
- `portrait-frost` (both `.portrait-frost-tl` and `.portrait-frost-br` variants — one base class)
- `portrait-waves`
- `portrait-compass`
- `portrait-ribbon`
- `portrait-drips`
- `portrait-feathers`
- `portrait-bird`

- [ ] **Step 1: Delete HTML + CSS + keyframes.**

```bash
grep -nE '\.portrait-(zodiac|stained-glass|mercury|frost|waves|compass|ribbon|drips|feathers|bird)\b' src/pages/Trương.astro
```

- [ ] **Step 2: Visual verification.**

Reload `/Trương`. Expected: portrait is visibly quieter. Owl still there (kept).

- [ ] **Step 3: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "refactor(truong): cut 10 off-register motifs

Drop: zodiac, stained-glass, mercury, frost, waves, compass, ribbon,
drips, feathers, bird. Astrology/photography/alchemy/nautical — all
pulling the portrait away from the mage center.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task C4: Cut remaining off-theme effects (7)

**Files:** `src/pages/Trương.astro`

Effects to remove:
- `portrait-soundwaves`
- `portrait-echo`
- `portrait-pool`
- `portrait-bubbles`
- `portrait-orbits`
- `portrait-rain`
- `portrait-holo`
- `portrait-alchemy`
- `portrait-mandala`

- [ ] **Step 1: Delete HTML + CSS + keyframes.**

```bash
grep -nE '\.portrait-(soundwaves|echo|pool|bubbles|orbits|rain|holo|alchemy|mandala)\b' src/pages/Trương.astro
```

- [ ] **Step 2: Visual verification.**

Reload `/Trương`. Expected: the portrait now reads as mage-only — snitch, owl, runes, vines, coin, lotus, rose window, baroque frame, plus the mage-adjacent effects already kept (sigil, hallows, patronus, portkey, lightning, constellation, aurora, mist, wisps, dust, sparkles, etc.).

- [ ] **Step 3: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "refactor(truong): cut 9 remaining off-theme effects

Final consolidation: soundwaves, echo, pool, bubbles, orbits, rain,
holo, alchemy, mandala. Portrait is now unmistakably mage — 27 effects
cut across 4 commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

## Phase D — Adds (7 new effects, one commit each)

Each new effect lands in the `<figure class="about-hero-photo" id="hero-photo">` block, alongside the existing kept effects. CSS goes in the `<style>` block, grouped by the `/* Portrait effects */` comment (or similar — match existing conventions).

### Task D1: Summoning circle (runes + years)

**Files:** `src/pages/Trương.astro`

- [ ] **Step 1: Insert the HTML inside the `<figure class="about-hero-photo">` block.**

Find the `.portrait-rose-window` block (around the current lines 333–346 area — will have shifted after the cuts). After it, insert:

```astro
{/* Summoning circle — inner runes + outer invention years, counter-rotating */}
<div class="portrait-summoning-circle" aria-hidden="true">
    <div class="sc-ring sc-ring-runes">
        {"ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ".split("").map((r, i) => (
            <span class="sc-rune" style={`--sc-angle: ${i * (360 / 24)}deg;`}>{r}</span>
        ))}
    </div>
    <div class="sc-ring sc-ring-years">
        {["2007", "·", "2008", "·", "2009", "·", "2024", "·"].map((y, i, a) => (
            <span class="sc-year" style={`--sc-angle: ${i * (360 / a.length)}deg;`}>{y}</span>
        ))}
    </div>
</div>
```

- [ ] **Step 2: Add CSS.**

```css
.portrait-summoning-circle {
    position: absolute;
    inset: -4%;
    z-index: 0;
    pointer-events: none;
    color: rgba(240, 199, 94, 0.55);
}
.portrait-summoning-circle .sc-ring {
    position: absolute;
    inset: 0;
    animation: sc-spin 60s linear infinite;
}
.portrait-summoning-circle .sc-ring-years {
    inset: -5%;
    animation: sc-spin 90s linear infinite reverse;
    font-family: "Cinzel", "Trajan Pro", serif;
    letter-spacing: 0.12em;
    font-size: 0.7rem;
    text-transform: uppercase;
}
.portrait-summoning-circle .sc-rune,
.portrait-summoning-circle .sc-year {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: start center;
    transform: rotate(var(--sc-angle));
}
.portrait-summoning-circle .sc-rune { font-size: 0.85rem; }
@keyframes sc-spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3: Visual verification.**

Reload. Expected: two concentric rings slowly counter-rotating behind the portrait; inner ring is Futhark runes, outer ring reads `2007 · 2008 · 2009 · 2024 ·` in serif capitals.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): add summoning circle (runes + invention years)

Two concentric rings counter-rotate behind the portrait. Outer ring
inscribes the four invention years (2007 · 2008 · 2009 · 2024) in
serif capitals — concrete career milestones, no future marker.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task D2: Grimoire pages drifting

**Files:** `src/pages/Trương.astro`

- [ ] **Step 1: Insert HTML inside the figure.**

```astro
{/* Grimoire — three translucent parchment pages drifting with faint sigil diagrams */}
<div class="portrait-grimoire-pages" aria-hidden="true">
    {[0, 1, 2].map((i) => (
        <svg class={`grimoire-page grimoire-page-${i + 1}`} viewBox="0 0 120 160" aria-hidden="true">
            <rect x="2" y="2" width="116" height="156" rx="2" fill="rgba(255, 245, 215, 0.05)" stroke="rgba(240, 199, 94, 0.3)" stroke-width="0.6" />
            <g stroke="rgba(240, 199, 94, 0.35)" stroke-width="0.4" fill="none">
                <line x1="16" y1={18 + i * 4} x2="104" y2={18 + i * 4} />
                <line x1="16" y1={28 + i * 4} x2="96" y2={28 + i * 4} />
                <circle cx="60" cy={74 + i * 6} r={18 - i * 2} />
                <path d={`M60 ${60 - i * 2} L${52 + i * 2} 74 L60 ${88 + i * 2} L${68 - i * 2} 74 Z`} />
                <circle cx="60" cy={74 + i * 6} r={8 - i} opacity="0.6" />
                <line x1="16" y1={120 + i * 2} x2="104" y2={120 + i * 2} />
                <line x1="16" y1={130 + i * 2} x2="88" y2={130 + i * 2} />
            </g>
        </svg>
    ))}
</div>
```

- [ ] **Step 2: Add CSS.**

```css
.portrait-grimoire-pages {
    position: absolute;
    inset: -8% -12%;
    z-index: 0;
    pointer-events: none;
}
.portrait-grimoire-pages .grimoire-page {
    position: absolute;
    width: 22%;
    opacity: 0.55;
    filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.5));
    animation: grimoire-drift 18s ease-in-out infinite;
}
.grimoire-page-1 { --gp-rot: -12deg; top: 6%; left: -6%; animation-delay: 0s; }
.grimoire-page-2 { --gp-rot: 9deg; top: 58%; right: -8%; animation-delay: 6s; }
.grimoire-page-3 { --gp-rot: -4deg; top: 32%; left: 94%; animation-delay: 12s; }
@keyframes grimoire-drift {
    0%, 100% { transform: translate(0, 0) rotate(var(--gp-rot, 0deg)); opacity: 0.45; }
    50% { transform: translate(6px, -10px) rotate(var(--gp-rot, 0deg)); opacity: 0.65; }
}
```

- [ ] **Step 3: Visual verification.**

Expected: three translucent parchment pages floating around the portrait at varying angles, each with faint handwritten sigil-like diagrams; gentle drift animation.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): add drifting grimoire pages with sigil diagrams

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task D3: Light-threads schematic lattice

**Files:** `src/pages/Trương.astro`

- [ ] **Step 1: Insert HTML.**

```astro
{/* Light threads — a 3D-looking lattice drawing itself in light beside the portrait */}
<svg class="portrait-light-threads" viewBox="0 0 200 260" aria-hidden="true">
    <g stroke="url(#flourishGrad)" stroke-width="0.8" fill="none" stroke-linecap="round">
        <path class="lt-stroke lt-1" d="M20 40 L100 20 L180 40 L180 140 L100 160 L20 140 Z" />
        <path class="lt-stroke lt-2" d="M100 20 L100 160" />
        <path class="lt-stroke lt-3" d="M20 40 L100 80 L180 40" />
        <path class="lt-stroke lt-4" d="M20 140 L100 100 L180 140" />
        <path class="lt-stroke lt-5" d="M100 80 L100 100" />
        <circle class="lt-node" cx="100" cy="20" r="2" />
        <circle class="lt-node" cx="100" cy="160" r="2" />
        <circle class="lt-node" cx="100" cy="80" r="1.5" />
        <circle class="lt-node" cx="100" cy="100" r="1.5" />
    </g>
</svg>
```

**Note:** `url(#flourishGrad)` is an existing gradient defined elsewhere in the file — reuse it (do NOT define a new gradient).

- [ ] **Step 2: Add CSS.**

```css
.portrait-light-threads {
    position: absolute;
    bottom: 4%;
    right: -18%;
    width: 24%;
    height: auto;
    z-index: 1;
    pointer-events: none;
    opacity: 0.7;
}
.portrait-light-threads .lt-stroke {
    stroke-dasharray: 400;
    stroke-dashoffset: 400;
    animation: lt-draw 8s ease-in-out infinite;
}
.portrait-light-threads .lt-1 { animation-delay: 0s; }
.portrait-light-threads .lt-2 { animation-delay: 0.8s; }
.portrait-light-threads .lt-3 { animation-delay: 1.6s; }
.portrait-light-threads .lt-4 { animation-delay: 2.4s; }
.portrait-light-threads .lt-5 { animation-delay: 3.2s; }
.portrait-light-threads .lt-node { fill: rgba(240, 199, 94, 0.9); opacity: 0; animation: lt-node-pulse 8s ease-in-out infinite; }
@keyframes lt-draw {
    0%, 10% { stroke-dashoffset: 400; }
    50%, 70% { stroke-dashoffset: 0; }
    100% { stroke-dashoffset: 400; }
}
@keyframes lt-node-pulse {
    0%, 40% { opacity: 0; }
    60%, 70% { opacity: 1; }
    100% { opacity: 0; }
}
```

- [ ] **Step 3: Visual verification.**

Expected: a geometric lattice (cube-like outline) near the bottom-right of the portrait, drawing itself in light, looping.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): add light-threads lattice — architecture-as-spell

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task D4: Circuit-rune sigils (4 corners)

**Files:** `src/pages/Trương.astro`

- [ ] **Step 1: Insert HTML.**

```astro
{/* Circuit-runes — Futhark glyphs that morph into PCB traces in four corners */}
<div class="portrait-circuit-runes" aria-hidden="true">
    {[
        { rune: "ᚠ", pos: "tl" },
        { rune: "ᚱ", pos: "tr" },
        { rune: "ᛏ", pos: "bl" },
        { rune: "ᛗ", pos: "br" },
    ].map(({ rune, pos }) => (
        <div class={`cr cr-${pos}`}>
            <svg viewBox="0 0 50 50" aria-hidden="true">
                <text x="25" y="32" text-anchor="middle" font-family="serif" font-size="22" fill="url(#flourishGrad)">{rune}</text>
                <g stroke="url(#flourishGrad)" stroke-width="0.6" fill="none" stroke-linecap="round">
                    <path class="cr-trace cr-trace-1" d="M25 40 L25 48 L14 48 L14 44" />
                    <path class="cr-trace cr-trace-2" d="M25 40 L25 48 L36 48 L36 44" />
                    <circle cx="14" cy="44" r="1" fill="url(#flourishGrad)" />
                    <circle cx="36" cy="44" r="1" fill="url(#flourishGrad)" />
                </g>
            </svg>
        </div>
    ))}
</div>
```

- [ ] **Step 2: Add CSS.**

```css
.portrait-circuit-runes { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
.portrait-circuit-runes .cr { position: absolute; width: 42px; height: 42px; opacity: 0.8; }
.portrait-circuit-runes .cr-tl { top: 2%; left: 2%; }
.portrait-circuit-runes .cr-tr { top: 2%; right: 2%; transform: scaleX(-1); }
.portrait-circuit-runes .cr-bl { bottom: 2%; left: 2%; transform: scaleY(-1); }
.portrait-circuit-runes .cr-br { bottom: 2%; right: 2%; transform: scale(-1, -1); }
.portrait-circuit-runes .cr-trace {
    stroke-dasharray: 40;
    stroke-dashoffset: 40;
    animation: cr-trace-draw 6s ease-in-out infinite;
}
.cr-tr .cr-trace { animation-delay: 1.5s; }
.cr-bl .cr-trace { animation-delay: 3s; }
.cr-br .cr-trace { animation-delay: 4.5s; }
@keyframes cr-trace-draw {
    0%, 15% { stroke-dashoffset: 40; }
    50%, 65% { stroke-dashoffset: 0; }
    100% { stroke-dashoffset: 40; }
}
```

- [ ] **Step 3: Visual verification.**

Expected: four small Futhark glyphs in the portrait corners, each with a thin PCB trace drawing out of the rune into the frame edge.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): add circuit-rune sigils in four corners

Futhark glyph + PCB trace — the wizard who codes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task D5: Candle glow flicker

**Files:** `src/pages/Trương.astro`

- [ ] **Step 1: Insert HTML.**

```astro
{/* Candle glow — warm tungsten flicker overlay replacing cold photography lighting */}
<div class="portrait-candle-glow" aria-hidden="true" />
```

- [ ] **Step 2: Add CSS.**

```css
.portrait-candle-glow {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: radial-gradient(ellipse at 30% 40%, rgba(255, 186, 110, 0.14) 0%, rgba(255, 186, 110, 0.06) 35%, transparent 70%);
    mix-blend-mode: screen;
    animation: candle-flicker 4.7s ease-in-out infinite;
}
@keyframes candle-flicker {
    0%, 100% { opacity: 0.9; transform: scale(1); }
    20% { opacity: 1; transform: scale(1.01); }
    40% { opacity: 0.85; transform: scale(0.99); }
    60% { opacity: 0.95; transform: scale(1.005); }
    80% { opacity: 0.9; transform: scale(0.995); }
}
```

- [ ] **Step 3: Visual verification.**

Expected: the portrait has a faint warm amber overlay that subtly pulses, replacing the cold blue-ish lens-flare lighting that existed before.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): add candle-glow flicker, warm tungsten tone

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task D6: Ink-bleed corner rune droplets

**Files:** `src/pages/Trương.astro`

- [ ] **Step 1: Insert HTML.**

```astro
{/* Ink bleed — droplets at corners that slowly bloom into small rune glyphs */}
<div class="portrait-ink-bleed" aria-hidden="true">
    {[
        { glyph: "ᛉ", pos: "tl" },
        { glyph: "ᛊ", pos: "tr" },
        { glyph: "ᛇ", pos: "bl" },
        { glyph: "ᛞ", pos: "br" },
    ].map(({ glyph, pos }) => (
        <span class={`ink-drop ink-drop-${pos}`}>
            <span class="ink-blob" />
            <span class="ink-rune">{glyph}</span>
        </span>
    ))}
</div>
```

- [ ] **Step 2: Add CSS.**

```css
.portrait-ink-bleed { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
.portrait-ink-bleed .ink-drop { position: absolute; width: 28px; height: 28px; display: grid; place-items: center; }
.portrait-ink-bleed .ink-drop-tl { top: 8%; left: 8%; }
.portrait-ink-bleed .ink-drop-tr { top: 8%; right: 8%; }
.portrait-ink-bleed .ink-drop-bl { bottom: 8%; left: 8%; }
.portrait-ink-bleed .ink-drop-br { bottom: 8%; right: 8%; }
.portrait-ink-bleed .ink-blob {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(60, 30, 12, 0.85) 0%, rgba(60, 30, 12, 0.4) 50%, transparent 75%);
    transform: scale(0);
    animation: ink-bloom 10s ease-in-out infinite;
}
.portrait-ink-bleed .ink-rune {
    position: relative;
    z-index: 1;
    font-family: serif;
    font-size: 0.9rem;
    color: rgba(240, 199, 94, 0.9);
    opacity: 0;
    animation: ink-rune-appear 10s ease-in-out infinite;
}
.ink-drop-tr .ink-blob, .ink-drop-tr .ink-rune { animation-delay: 2.5s; }
.ink-drop-bl .ink-blob, .ink-drop-bl .ink-rune { animation-delay: 5s; }
.ink-drop-br .ink-blob, .ink-drop-br .ink-rune { animation-delay: 7.5s; }
@keyframes ink-bloom {
    0%, 10% { transform: scale(0); }
    40%, 70% { transform: scale(1); }
    90%, 100% { transform: scale(1.4); opacity: 0; }
}
@keyframes ink-rune-appear {
    0%, 30% { opacity: 0; }
    50%, 70% { opacity: 1; }
    90%, 100% { opacity: 0; }
}
```

- [ ] **Step 3: Visual verification.**

Expected: four corners each have an ink droplet that slowly expands and fades, revealing a small rune glyph that holds briefly then fades. Staggered timing (each corner 2.5s offset).

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): add ink-bleed corner rune droplets

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

### Task D7: Incantation on hover

**Files:** `src/pages/Trương.astro`

- [ ] **Step 1: Insert HTML inside `<figure class="about-hero-photo">`.**

```astro
{/* Incantation — handwritten line rises on hover */}
<span class="portrait-incantation" aria-hidden="true">
    {isVi ? "Tôi không đọc bùa chú. Tôi viết ra chúng." : "I do not cast spells. I build them."}
</span>
```

- [ ] **Step 2: Add CSS.**

```css
.portrait-incantation {
    position: absolute;
    left: 50%;
    bottom: 2%;
    transform: translate(-50%, 16px);
    width: max-content;
    max-width: 90%;
    font-family: "Caveat", "Homemade Apple", cursive;
    font-size: 1.1rem;
    color: rgba(240, 199, 94, 0.95);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
    opacity: 0;
    transition: opacity 450ms ease-out, transform 450ms ease-out;
    pointer-events: none;
    z-index: 4;
    text-align: center;
    white-space: nowrap;
}
.about-hero-photo:hover .portrait-incantation {
    opacity: 1;
    transform: translate(-50%, 0);
}
@media (max-width: 600px) {
    .portrait-incantation { font-size: 0.9rem; white-space: normal; }
}
```

- [ ] **Step 3: Visual verification.**

Expected: hover over the portrait → handwritten amber line rises from the bottom edge and holds visible while hovering; fades away when the pointer leaves. VI variant appears when language is Vietnamese.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/Trương.astro
git commit -m "feat(truong): add incantation-on-hover

\"I do not cast spells. I build them.\" / \"Tôi không đọc bùa chú.
Tôi viết ra chúng.\" — profession-of-art for the Architect-Mage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Co-Authored-By: deathemperor <deathemperor@gmail.com>"
```

---

## Phase E — Verification (1 task)

### Task E1: Final review pass + production build

**Files:** none (verification only)

- [ ] **Step 1: Run the project review checklist.**

From `docs/superpowers/specs/…-design.md#review-checklist`, confirm each:

```bash
# 1. Astro.cache.set present
grep -n 'Astro\.cache\.set' src/pages/Trương.astro

# 2. No new target="_blank" on in-site routes. Must return zero matches on /hol or /pensieve links:
grep -nE 'href="(/hol|/pensieve)[^"]*"[^>]*target="_blank"' src/pages/Trương.astro

# 3. All new EN strings have VI pairs. Eyeball the diff:
git diff 6364fb67..HEAD -- src/pages/Trương.astro | grep -E '^\+' | grep -viE 'isVi|\\"' | head -40
# Expected: every new English literal appears alongside an isVi ternary

# 4. No link() helper used (root-level page, absolute paths only).
grep -n 'link(' src/pages/Trương.astro
# Expected: zero matches (or only pre-existing ones — none added).

# 5. No localhost:300x leaks.
grep -nE 'localhost:300[0-9]' src/pages/Trương.astro
# Expected: zero matches.
```

- [ ] **Step 2: Run the production build to catch type/Astro errors.**

```bash
npx astro build
```

Expected: `Completed in Xs.` with no type errors or warnings about `Trương.astro`. If errors appear, fix them and run the build again before moving on.

- [ ] **Step 3: Full visual walk-through in the browser.**

Reload `/Trương` (dev). Click-through checklist:
- [ ] Hero subtitle shows 8 roles
- [ ] GitHub meta row shows live repo count + "∞ AI agents"
- [ ] Narrative has 4 paragraphs now (name, VNG credits, Papaya/Oasis, cichlids, mentor/AI)
- [ ] Community section sits above narrative with 4 cards
- [ ] `/hol` card opens in same tab; external forum cards open in new tab
- [ ] Portrait reads as mage — summoning circle years visible, grimoire pages drifting, light-threads drawing, candle glow warming, circuit-rune corners, ink-bleed corners blooming
- [ ] Hover portrait → incantation fades in
- [ ] Language toggle works for every new string (VI/EN pair)
- [ ] Console is free of errors (open devtools → Console)
- [ ] GitHub Activity section → Claude Code era shows a number >232

- [ ] **Step 4: Skim diff one more time.**

```bash
git log --oneline 6364fb67..HEAD
git diff 6364fb67..HEAD --stat
```

Expected: ~17 commits, `src/pages/Trương.astro` modified (net change within the 4000-line envelope; cuts + adds roughly balance).

---

## Done

- Task complete when Phase E step 4 shows a clean diff and no regressions.
- **Diary** hooks will run on `git push`, prompting entries for this session's plans/insights — that's a follow-up, not part of this plan.
- Next-session follow-ups (out of scope here):
  - If the 14 approved kept-mage-adjacent effects (e.g. `portrait-aurora`, `portrait-mist`) feel redundant after all the removals, do a second pass.
  - Consider moving the Community section's Rô Mỹ link to the actual FB URL if different from the placeholder `facebook.com/groups/romy`.
