# Session Log

## 2026-04-10

### Chrome MCP test
> test chrome mcp

Connected to Chrome browser via MCP, listed 11 open tabs.

### Download Messenger conversation media
> download all images and videos of this conversation

Attempted to download media from Facebook Messenger E2EE conversation. Used canvas+crossOrigin approach to bypass CORS. Downloaded 39 images (7 full-res 1536x2048, 32 thumbnails). Facebook's virtualized scrolling blocked full conversation scan.

### Move files and build plant gallery
> move them here, to ~/death/plant-gallery-v1, then build a web tool for me to view and select as in shopping to buy

Moved files to plant-gallery-v1. Built a single-page gallery with dark theme, image grid, lightbox, cart panel, filter buttons, and JSON export of selections.

### Fix: only conversation images
> what the fuck, why did you downloaded all the profile pictures?

Cleaned up — removed 32 thumbnail/avatar/sticker files, kept only 7 full-res conversation photos. Rescanned conversation for more but Facebook scroll blocked at ~59%.

### Use manually downloaded files
> I've downloaded the files at ~/Downloads/ts, use them

Copied 63 photos + 3 videos from ~/Downloads/ts. Renamed to plant_00-63.jpg and video_01-03.mp4. Rebuilt gallery with video support.

### Remove CodeArtifact from npmrc
> remove codeartifact stuffs in root npmrc

Emptied ~/.npmrc (removed registry + auth token lines for CodeArtifact).

### Wrangler setup for Cloudflare
> wrangler login, create D1/KV/R2

Ran wrangler login (OAuth flow). Created D1 database (pensieve-db), KV namespace (SESSION), R2 bucket (pensieve-media). Pasted IDs into wrangler.jsonc. R2 required user to enable it in dashboard first.

## 2026-04-11

### Add quantity to cart + migrate to pensieve
> the cart feature needs a quantity input + migrate to pensieve

Refactored cart from Set to Map (file->qty). Added quantity controls. Copied to pensieve/public/plant-gallery/. Updated build script and worker routes.

### Deploy
> deploy

Ran `bun run deploy`. 68 files uploaded. Live at huuloc.com/plant-gallery/.

### What is Astro/EmDash
> what does astro has anything to do with emdash?

Explained: EmDash is a CMS built as an Astro integration. Astro = framework, EmDash = CMS layer on top.

### URL should be /plant-gallery
> url should be plant-gallery

Added /plant-gallery/* route handler in worker.ts. Excluded plant-gallery from asset relocation. Deployed.

## 2026-04-12

### README
> populate a proper README for repo

Wrote website-focused README describing Pensieve, bilingual content, themed categories, RSS feeds.

### Fix Papaya link
> papaya.asia, not papaya.vn

Updated src/home-html.ts. Pushed.

### GitHub Actions deploy
> can deployment be done on github?

Created .github/workflows/deploy.yml with Node 22 + bun + wrangler-action. User added CLOUDFLARE_API_TOKEN to GitHub secrets. Fixed Node version issue on first run.

### Lang chooser to dropdown + cookie
> lang chooser should be a dropdown, use cookies not url params

Replaced VI/EN links with dropdown. Language set via pref_lang cookie from JS. Removed ?lang= URL param support.

### Lang dropdown far right + home to root
> lang chooser should be on far right / home should be to root

Moved dropdown to far right with margin-left:auto. Changed home links to "/".

### Session logging
> logs on the conversations to an md file, always do so

Created session-log.md. Set up logging hook and saved feedback memory.

### Comment section + moderation
> does the comment section work? / build a sub agent for comment moderation

Comments work out of the box. Created moderation subagent at `.claude/agents/moderate-comments.md`. Changed "Published" to "Remembered". Added LinkedIn/Facebook/GitHub to home footer.

### Run moderator
> run the moderator

Found 1 pending test comment ("hi" / "me@p.com" / "comment"). Trashed it via wrangler D1.

### Lang dropdown style + README + formatting fixes
> change lang dropdown to match Categories style / update README / fix session-log format / add social profiles

Changed lang dropdown from `<select>` to `<details>` matching Categories style. Updated README (home page, not just writing space, removed technical details below Development). Fixed session-log.md formatting. Updated moderator agent to use wrangler D1.

### Social links as section on root
> links to my profile should be a section on root

Added "Elsewhere" section on huuloc.com landing page with GitHub, LinkedIn, Facebook links. Cleaned footer to just copyright.

### Comment moderation notice
> should note that comments are moderated

Added "Comments are moderated and may take a moment to appear." below the comment form on post pages.

### Run moderator (2nd time)
> run the moderator

No pending comments. Inbox clean — only the 1 previously trashed test comment.

### Admin account
> create an admin account for me / should allow me to log in using github

EmDash supports GitHub OAuth out of the box via environment variables. No code changes needed. User created a GitHub OAuth App, set OAuth secrets via `wrangler secret put`. GitHub login now available at the admin UI.

### Session logger subagent
> create the session log sub agent for ./pensieve

Created `.claude/agents/session-logger.md` — subagent that appends entries to session-log.md with date headers, blockquoted prompts, and concise summaries.

### Remove EmDash footer
> remove Powered by EmDash on footer

Replaced "Powered by EmDash" with "© Trương Hữu Lộc" in the Pensieve footer.
