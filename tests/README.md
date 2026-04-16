# Tests

Pensieve uses Node's built-in test runner (`node --test`) via `tsx` for TypeScript. No jest, vitest, or other framework needed.

## Running tests

    bun run test                                    # all
    node --import tsx --test tests/animations/      # just animations

## Writing a test

    import { test } from "node:test";
    import assert from "node:assert/strict";

    test("example", () => {
      assert.equal(1 + 1, 2);
    });

## Running subprocesses in tests

Always use `execFileSync` from `node:child_process` with the arg-array form. Do not use template-string commands — that pattern is a shell-injection risk and is flagged by the repo's security hook.

Safe example:

    import { execFileSync } from "node:child_process";
    const out = execFileSync(
      "npx",
      ["wrangler", "d1", "execute", "pensieve-db", "--remote", "--command", "SELECT 1"],
      { encoding: "utf8" },
    );

## Layout

Tests mirror `src/` paths under `tests/`. Fixture data lives in `src/fixtures/<feature>/`.

## Lighthouse baselines

### Quidditch Pitch (Plan A acceptance)

Start the dev server:

    bun run dev

Then run Lighthouse:

    npx --yes lighthouse http://localhost:4321/hogwarts/quidditch/ \
      --preset=desktop \
      --only-categories=performance,accessibility,seo \
      --chrome-flags="--headless" \
      --output=json \
      --output-path=./lighthouse-quidditch.json

Targets: performance ≥ 90, accessibility ≥ 90, seo ≥ 90.

Baseline on 2026-04-16 (placeholder-only content): **performance 93, accessibility 95, seo 100**.
