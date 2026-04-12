/**
 * huuloc.com root landing page.
 *
 * This is served directly from src/worker.ts at `/` — not through Astro —
 * because the Astro site is scoped to `base: "/pensieve"` and can't respond
 * to requests at the domain root. Kept intentionally simple: one column,
 * minimal chrome, same dark canvas + Inter Variable + 590-weight headings
 * as Pensieve, linking out to all projects under huuloc.com.
 */

export const HOME_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
	<style>
		.mark { fill: none; stroke: #08090a; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
		.fill { fill: #08090a; }
		@media (prefers-color-scheme: dark) {
			.mark { stroke: #f7f8f8; }
			.fill { fill: #f7f8f8; }
		}
	</style>
	<ellipse cx="16" cy="10.5" rx="11" ry="2.75" class="mark" />
	<path d="M5 10.5 L5 14 C5 20.5 9.5 25 16 25 C22.5 25 27 20.5 27 14 L27 10.5" class="mark" />
	<ellipse cx="16" cy="10.5" rx="4.5" ry="1.1" class="fill" />
</svg>`;

export const HOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Trương Hữu Lộc</title>
<meta name="description" content="Senior engineer, bilingual writer, Vietnam. Projects and long-form writing live here." />
<meta property="og:title" content="Trương Hữu Lộc" />
<meta property="og:description" content="Senior engineer, bilingual writer, Vietnam. Projects and long-form writing live here." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://huuloc.com/" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
  :root {
    --bg: #08090a;
    --elevated: #141516;
    --text: #f7f8f8;
    --secondary: #8a8f98;
    --muted: #62666d;
    --border: rgba(255, 255, 255, 0.06);
    --accent: #5e6ad2;
    --sans: "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.55;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: clamp(3rem, 10vh, 6rem) 1.5rem 4rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* Hero */
  .hero {
    margin-bottom: 4rem;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--muted);
    letter-spacing: 0.04em;
    margin-bottom: 2rem;
  }

  .eyebrow svg {
    flex-shrink: 0;
  }

  .name {
    font-family: var(--sans);
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    font-weight: 590;
    letter-spacing: -0.024em;
    line-height: 1.08;
    margin: 0 0 0.75rem;
    color: var(--text);
  }

  .role {
    font-size: 1.0625rem;
    color: var(--secondary);
    margin: 0 0 1.5rem;
    max-width: 52ch;
  }

  .bio {
    font-size: 1rem;
    color: var(--secondary);
    margin: 0;
    max-width: 56ch;
    line-height: 1.65;
  }

  .bio a {
    color: var(--text);
    text-decoration: none;
    border-bottom: 1px solid var(--border);
    transition: border-color 120ms ease;
  }

  .bio a:hover {
    border-color: var(--secondary);
  }

  /* Sections */
  .section {
    margin-bottom: 3rem;
  }

  .section-label {
    display: block;
    font-family: var(--mono);
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 1rem;
  }

  /* Project cards */
  .project-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .project {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: start;
    gap: 1rem;
    padding: 1.25rem 1.25rem 1.125rem;
    background: var(--elevated);
    border: 1px solid var(--border);
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    transition:
      border-color 120ms ease,
      transform 120ms ease;
  }

  .project:hover {
    border-color: rgba(255, 255, 255, 0.18);
    transform: translateY(-1px);
  }

  .project-head {
    display: flex;
    align-items: baseline;
    gap: 0.625rem;
    margin-bottom: 0.375rem;
  }

  .project-name {
    font-family: var(--sans);
    font-size: 1.0625rem;
    font-weight: 590;
    letter-spacing: -0.015em;
    color: var(--text);
    margin: 0;
  }

  .project-meta {
    font-family: var(--mono);
    font-size: 0.6875rem;
    color: var(--muted);
    letter-spacing: 0.03em;
  }

  .project-desc {
    font-size: 0.9375rem;
    color: var(--secondary);
    margin: 0;
    line-height: 1.55;
  }

  .project-arrow {
    color: var(--muted);
    font-size: 1rem;
    transition: color 120ms ease, transform 120ms ease;
    padding-top: 2px;
  }

  .project:hover .project-arrow {
    color: var(--text);
    transform: translateX(2px);
  }

  .project[data-dim="true"] {
    opacity: 0.55;
    cursor: default;
  }

  .project[data-dim="true"]:hover {
    transform: none;
    border-color: var(--border);
  }

  /* Footer */
  .links-row {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .link-item {
    font-size: 0.9375rem;
    color: var(--secondary);
    text-decoration: none;
    border-bottom: 1px solid var(--border);
    padding-bottom: 1px;
    transition: color 120ms ease, border-color 120ms ease;
  }

  .link-item:hover {
    color: var(--text);
    border-color: var(--secondary);
  }

  .foot {
    margin-top: auto;
    padding-top: 3rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.875rem;
    font-family: var(--mono);
    font-size: 0.75rem;
    color: var(--muted);
    letter-spacing: 0.02em;
  }

  .foot a {
    color: var(--secondary);
    text-decoration: none;
    transition: color 120ms ease;
  }

  .foot a:hover {
    color: var(--text);
  }

  .foot-sep {
    opacity: 0.4;
  }

  @media (max-width: 600px) {
    .page {
      padding: 3rem 1.25rem 3rem;
    }
  }
</style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="eyebrow">
        <svg width="14" height="14" viewBox="0 0 32 32">
          <ellipse cx="16" cy="10.5" rx="11" ry="2.75" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M5 10.5 L5 14 C5 20.5 9.5 25 16 25 C22.5 25 27 20.5 27 14 L27 10.5" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
          <ellipse cx="16" cy="10.5" rx="4.5" ry="1.1" fill="currentColor" />
        </svg>
        huuloc.com
      </div>

      <h1 class="name">Trương Hữu Lộc</h1>
      <p class="role">Senior software engineer. Bilingual writer. Based in Vietnam.</p>
      <p class="bio">
        At VNG from 2006, building session systems and game publishing platforms.
        Now at <a href="https://papaya.asia" rel="noopener">Papaya</a>, putting AI agents
        to work on the craft side of software. Writes long-form in Vietnamese and English —
        mostly about memory, family, fish, and the things worth keeping.
      </p>
    </section>

    <section class="section">
      <span class="section-label">Spaces</span>
      <ul class="project-list">
        <li>
          <a href="/pensieve/" class="project">
            <div>
              <div class="project-head">
                <h2 class="project-name">Pensieve</h2>
                <span class="project-meta">VI · EN · 130 posts</span>
              </div>
              <p class="project-desc">
                Long-form narratives rescued from Facebook, sorted into themed
                categories with every post available in both Vietnamese and English.
              </p>
            </div>
            <span class="project-arrow">→</span>
          </a>
        </li>
        <li>
          <a href="/room-of-requirement" class="project">
            <div>
              <div class="project-head">
                <h2 class="project-name">Room of Requirement</h2>
                <span class="project-meta">Build diary</span>
              </div>
              <p class="project-desc">
                How this site is built — architecture, tech stack, and
                Priori Incantatem: a timeline of every Claude Code session.
              </p>
            </div>
            <span class="project-arrow">→</span>
          </a>
        </li>
        <li>
          <a href="/Trương" class="project">
            <div>
              <div class="project-head">
                <h2 class="project-name">Trương</h2>
                <span class="project-meta">About</span>
              </div>
              <p class="project-desc">
                Origin story, profile links, and live GitHub activity.
              </p>
            </div>
            <span class="project-arrow">→</span>
          </a>
        </li>
      </ul>
    </section>

    <section class="section">
      <span class="section-label">Elsewhere</span>
      <div class="links-row">
        <a href="https://github.com/deathemperor" rel="noopener" class="link-item">GitHub</a>
        <a href="https://www.linkedin.com/in/deathemperor/" rel="noopener" class="link-item">LinkedIn</a>
        <a href="https://fb.me/deathemperor" rel="noopener" class="link-item">Facebook</a>
      </div>
    </section>

    <footer class="foot">
      <span>© Trương Hữu Lộc</span>
    </footer>
  </main>
</body>
</html>`;
