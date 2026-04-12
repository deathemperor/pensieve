# Pensieve

Personal writing space at [huuloc.com/pensieve](https://huuloc.com/pensieve) by Trương Hữu Lộc.

Long-form narratives rescued from Facebook, sorted into themed categories with every post available in both Vietnamese and English. Topics range across memory, family, fish, and the things worth keeping.

## What's here

- **Bilingual posts** — each piece is published in Vietnamese and English, with a translation banner linking the two versions
- **Themed categories** — posts are grouped by topic, each category carrying its own visual identity
- **Full-text search** — find posts by title, excerpt, or body content
- **RSS feeds** — separate feeds for [English](https://huuloc.com/pensieve/rss-en.xml) and [Vietnamese](https://huuloc.com/pensieve/rss-vi.xml)

## Built with

[Astro](https://astro.build) + [EmDash CMS](https://github.com/emdash-cms/emdash), running on Cloudflare Workers with D1 (database), R2 (media), and KV (sessions).

## Development

```bash
bun install
npx emdash dev
```

Dev server starts at `http://localhost:4321/pensieve/`. Admin UI at `/_emdash/admin`.

## Deployment

Pushes to `main` auto-deploy via GitHub Actions. Manual deploy:

```bash
bun run deploy
```

Requires a `CLOUDFLARE_API_TOKEN` secret in the repo for CI, or local `wrangler login` for manual deploys.

## License

Private.
