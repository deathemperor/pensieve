# Session Log

## 2026-04-10

### Chrome MCP test
**Prompt:** test chrome mcp
**Done:** Connected to Chrome browser via MCP, listed 11 open tabs successfully.

### Download Messenger conversation media
**Prompt:** download all images and videos of this conversation https://www.facebook.com/messages/e2ee/t/28423936667197243/#
**Done:** Attempted to download media from Facebook Messenger E2EE conversation. Used canvas+crossOrigin approach to bypass CORS. Downloaded 39 images (7 full-res 1536x2048, 32 thumbnails). Facebook's virtualized scrolling blocked full conversation scan.

### Move files and build plant gallery
**Prompt:** move them here, to ~/death/plant-gallery-v1, then build a web tool for me to view and select as in shopping to buy
**Done:** Moved files to ~/death/plant-gallery-v1. Built a single-page gallery with dark theme, image grid, lightbox (double-click), cart panel, filter buttons, and JSON export of selections. Served at localhost:8765.

### Fix: only conversation images
**Prompt:** what the fuck, why did you downloaded all the profile pictures?
**Done:** Cleaned up — removed 32 thumbnail/avatar/sticker files, kept only 7 full-res conversation photos. Rescanned conversation for more but Facebook scroll blocked at ~59%. Updated gallery.

### Use manually downloaded files
**Prompt:** I've downloaded the files at ~/Downloads/ts, use them
**Done:** Copied 63 photos + 3 videos from ~/Downloads/ts to plant-gallery-v1. Renamed to plant_00-63.jpg and video_01-03.mp4. Rebuilt gallery with video support (playback in lightbox, yellow VIDEO badge, filter by type).

### Remove CodeArtifact from npmrc
**Prompt:** remove codeartifact stuffs in root npmrc
**Done:** Emptied ~/.npmrc (removed registry + auth token lines for CodeArtifact).

### Wrangler setup for Cloudflare
**Prompt:** wrangler login, create D1/KV/R2
**Done:** Ran wrangler login (OAuth flow). Created D1 database (pensieve-db), KV namespace (SESSION), R2 bucket (pensieve-media). Pasted IDs into wrangler.jsonc. R2 required user to enable it in dashboard first.

## 2026-04-11

### Add quantity to cart + migrate to pensieve
**Prompt:** the cart feature in ./plant-gallery-v1 need to have a quantity input. also, migrate it to be under ./pensieve too
**Done:** Refactored cart from Set to Map (file→qty). Added −/input/+ quantity controls per cart item. Qty badge on cards. Export includes quantities. Copied to pensieve/public/plant-gallery/. Updated build script to exclude plant-gallery from asset relocation. Added /plant-gallery/* route in worker.ts.

### Deploy
**Prompt:** deploy
**Done:** Ran `bun run deploy` — built and deployed to Cloudflare. 68 files uploaded. Live at huuloc.com/plant-gallery/.

### What is Astro/EmDash
**Prompt:** what does astro has anything to do with emdash?
**Done:** Explained: EmDash is a CMS built as an Astro integration. Astro = framework, EmDash = CMS layer on top.

### URL should be /plant-gallery
**Prompt:** url should be plant-gallery (was 404 at /plant-gallery/)
**Done:** Added /plant-gallery/* route handler in worker.ts that serves from env.ASSETS. Excluded plant-gallery from build:relocate-assets script. Deployed — live at huuloc.com/plant-gallery/.

## 2026-04-12

### README
**Prompt:** populate a proper README for repo
**Done:** First wrote technical README, user wanted website-focused instead. Rewrote as website description: what Pensieve is, bilingual content, themed categories, RSS feeds, minimal dev/deploy instructions.

### Fix Papaya link
**Prompt:** papaya.asia, not papaya.vn
**Done:** Updated src/home-html.ts: papaya.vn → papaya.asia. Pushed.

### GitHub Actions deploy
**Prompt:** can deployment be done on github? / you get that info from chrome. then build it
**Done:** Got Cloudflare account ID via wrangler whoami. Attempted to create API token via Chrome automation on Cloudflare dashboard — cookie consent dialog blocked form submission repeatedly. Created .github/workflows/deploy.yml with Node 22 setup + bun + wrangler-action. User created API token manually and added CLOUDFLARE_API_TOKEN secret to GitHub. Pushed — first run failed (Node 20 vs 22 requirement), fixed and pushed again.

### Lang chooser to dropdown + cookie
**Prompt:** lang chooser should be a dropdown, and it should not use url parms for lang but should set on cookies and use it
**Done:** Replaced VI·EN link toggle with `<select>` dropdown. Removed ?lang= URL param support from getCurrentLang(). Language now set via pref_lang cookie from client-side JS on dropdown change. Translation links on post pages also set cookie before navigating.

### Lang dropdown far right + home to root
**Prompt:** lang chooser should be on far right / home should be to root
**Done:** Moved `<select>` to after all nav items with margin-left:auto. Changed site title, footer logo, and footer Home link from link() (/pensieve/) to "/" (root). Pushed.

### Session logging
**Prompt:** logs on the conversations I've sent and what you did to an md file for history, always do so for every prompts
**Done:** Created ~/death/session-log.md with full history of this session. Saved feedback memory to always log prompts going forward.
