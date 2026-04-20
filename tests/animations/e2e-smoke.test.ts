import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const DEV_URL = "http://localhost:4321";

async function waitForServer(ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${DEV_URL}/`);
      if (r.ok) return true;
    } catch {
      // not up yet
    }
    await delay(500);
  }
  return false;
}

test(
  "landing page + per-animation page render with expected content",
  { timeout: 120_000 },
  async () => {
    const dev: ChildProcess = spawn("bun", ["run", "dev"], {
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "development" },
    });

    try {
      const up = await waitForServer(60_000);
      assert.ok(up, "dev server started within 60s");

      const landing = await fetch(`${DEV_URL}/hogwarts/quidditch/`);
      assert.equal(landing.status, 200, "landing responds 200");
      const landingHtml = await landing.text();
      assert.match(landingHtml, /Quidditch Pitch|Sân Quidditch/, "landing has title");
      assert.match(landingHtml, /Placeholder/, "landing shows placeholder card");

      const detail = await fetch(`${DEV_URL}/hogwarts/quidditch/placeholder`);
      assert.equal(detail.status, 200, "detail responds 200");
      const detailHtml = await detail.text();
      assert.match(detailHtml, /Placeholder/, "detail has title");
      assert.match(detailHtml, /raw-viewer/, "detail has raw viewer");
      assert.match(detailHtml, /cursor-0/, "detail has cursor-0 entry");
      assert.match(detailHtml, /v1 static snitch/, "detail shows chapter label");

      const preview = await fetch(`${DEV_URL}/animation-preview/placeholder`);
      assert.equal(preview.status, 200, "preview responds 200");
      const previewHtml = await preview.text();
      assert.match(previewHtml, /snitch-stage/, "preview shows hero");
      assert.doesNotMatch(previewHtml, /site-footer|breadcrumb/i, "preview has no chrome");

      const missing = await fetch(`${DEV_URL}/hogwarts/quidditch/does-not-exist`);
      assert.equal(missing.status, 404, "missing slug 404s");
    } finally {
      dev.kill("SIGINT");
      await delay(1000);
    }
  },
);
