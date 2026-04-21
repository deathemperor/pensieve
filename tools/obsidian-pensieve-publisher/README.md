# Pensieve Publisher

Obsidian plugin that publishes the current note to the Pensieve (EmDash CMS) site at huuloc.com, and optionally cross-posts the result to Facebook.

## What it does

- Translates the note's markdown body to EmDash Portable Text.
- Reads YAML frontmatter for title, slug, language, excerpt, category, tags, and status.
- POSTs to `/_emdash/api/content/posts` (create) or PATCHes it (update on re-publish).
- Assigns taxonomies after create.
- Writes `pensieve_id` and `pensieve_url` back into the note's frontmatter so a second "Publish" updates the existing post instead of creating a duplicate.
- Optionally calls the Facebook Graph API to post the new URL to a page feed.

## Frontmatter schema

```yaml
---
title: "Cách tự học tiếng Anh cho người bận rộn"
slug: cach-tu-hoc-tieng-anh-cho-nguoi-ban-ron    # optional, auto-slugged otherwise
language: vi
original_language: vi                             # if this note is the original
excerpt: "Phương pháp tự luyện tiếng Anh…"
category: education
tags: [learning, english]
status: published                                 # or: draft
---
```

After the first publish, the plugin appends two read-only fields:

```yaml
pensieve_id: 01KPKZG8W97WDTDET3KY1X39GC
pensieve_url: https://huuloc.com/pensieve/memories/cach-tu-hoc-tieng-anh-cho-nguoi-ban-ron
```

## Commands

- **Publish current note to Pensieve** — respects the auto-cross-post setting.
- **Publish current note to Pensieve (no Facebook)** — explicit Pensieve-only.
- **Publish current note to Pensieve + Facebook** — explicit cross-post, even if the toggle is off.

Each command is also available via the upload-cloud ribbon icon.

## Build

```bash
cd tools/obsidian-pensieve-publisher
npm install
npm run build    # produces main.js
```

Copy `main.js`, `manifest.json`, and `styles.css` into
`<vault>/.obsidian/plugins/pensieve-publisher/` and enable the plugin in Obsidian's Community Plugins settings.

For development, `npm run dev` watches for changes. Symlink the plugin directory into your vault for fast iteration.

## Install on mobile via BRAT

Obsidian on iOS/Android can sideload this plugin via **BRAT** (Obsidian42 - BRAT), which pulls from GitHub releases.

1. On mobile: Settings → Community plugins → Browse → install **Obsidian42 - BRAT** → enable.
2. BRAT settings → **Add beta plugin** → paste `deathemperor/obsidian-pensieve-publisher`.
3. Enable **Pensieve Publisher** in Community plugins.
4. Configure the settings tab with your EmDash URL, API token, and (optional) Facebook credentials.

BRAT auto-updates within a few hours of a new release.

## Cutting a release

The plugin source lives here (in the Pensieve monorepo). A second repo
`deathemperor/obsidian-pensieve-publisher` hosts releases for BRAT.

To publish a new version:

1. Bump `version` in **both** `manifest.json` and `package.json` (they must match).
2. Commit the bump in the monorepo.
3. From this directory, run:
   ```bash
   npm run release
   ```

The release script (`scripts/release.sh`) will:
- Build the plugin.
- Clone the distribution repo into a temp dir.
- Mirror the source tree (excluding `node_modules` / `data.json` / build caches).
- Commit and push if anything changed.
- Tag the version and push the tag.
- Create a GitHub release with `main.js`, `manifest.json`, and `styles.css` attached as assets.

Preconditions: `gh` CLI authenticated (`gh auth status` shows logged-in), `rsync` and `git` on PATH. The distribution repo URL + owner is hard-coded in the script — edit it if you fork this plugin to a different repo.

## Configuration

Obsidian → Settings → Pensieve Publisher:

- **Site URL** — `https://huuloc.com` (no trailing slash).
- **API token** — generate from EmDash admin UI (Settings → API tokens). Needs write scope on the `posts` collection.
- **Default language / category / status** — used when the note's frontmatter omits them.
- **Auto cross-post to Facebook** — when on, every publish also calls the Facebook Graph API.
- **Facebook page ID** — numeric ID of the target page.
- **Facebook page access token** — long-lived token with `pages_manage_posts` scope. Follow the Graph API Explorer → Generate Access Token flow to get one; then extend it to a long-lived variant via `/oauth/access_token?grant_type=fb_exchange_token&client_id=…&client_secret=…&fb_exchange_token=…`.

## Markdown coverage

The bundled markdown parser handles the cases that show up in long-form writing:

- Paragraphs (blank-line separated)
- Headings `#`, `##`, `###` → Portable Text `h1`/`h2`/`h3`
- Fenced code blocks with language tags
- Unordered lists (`-`, `*`, `+`) and ordered lists with indent-based nesting
- Inline: `**bold**`, `*italic*`, `` `code` ``, `[text](url)` links (Portable Text `markDefs`)

Anything else (tables, blockquotes, embedded images, wiki-links) falls through as paragraph text. Fix in the EmDash admin UI after publishing if needed.

## Security notes

- The API token and Facebook access token are stored in the plugin's data file (`<vault>/.obsidian/plugins/pensieve-publisher/data.json`) as plain JSON. Treat this vault as trusted. Don't commit `data.json` to a shared vault repo.
- The plugin uses Obsidian's `requestUrl` (bypasses browser CORS), so it can talk to the admin API directly.
