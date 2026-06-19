# Pensieve

[huuloc.com](https://huuloc.com) — personal home page of Trương Hữu Lộc. Started as a writing space, growing into more.

The blog at [/pensieve](https://huuloc.com/pensieve) collects long-form narratives rescued from Facebook, sorted into themed categories with every post available in both Vietnamese and English. Topics range across memory, family, fish, and the things worth keeping.

## What's here

- **Bilingual posts** — each piece is published in Vietnamese and English, with a translation banner linking the two versions
- **Themed categories** — posts are grouped by topic, each category carrying its own visual identity
- **Full-text search** — find posts by title, excerpt, or body content
- **RSS feeds** — separate feeds for [English](https://huuloc.com/pensieve/rss-en.xml) and [Vietnamese](https://huuloc.com/pensieve/rss-vi.xml)

## Built with

[Astro](https://astro.build) + [EmDash CMS](https://github.com/emdash-cms/emdash), running on Cloudflare Workers with D1, R2, and KV.

## Developer setup

Install the CLI toolbelt this project leans on (search, git, JSON, container, and
security tooling). Idempotent — safe to re-run:

```bash
scripts/onboard.sh            # everything
scripts/onboard.sh --core     # just the everyday essentials
scripts/onboard.sh --no-shell # skip shell-rc changes
```

Installs Homebrew if missing, then the formulae plus a few non-brew extras
(composio, llmfit, the `gh-dash` extension), and wires `atuin` + `direnv` into
your shell rc. See the header of `scripts/onboard.sh` for the full list.
