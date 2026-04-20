import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareSession } from "../../scripts/publish-animations.ts";

function sh(script: string, stdin = ""): string {
  const result = spawnSync("bash", ["-c", script], { input: stdin, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`script failed (${result.status}): ${result.stderr}`);
  }
  return result.stdout + result.stderr;
}

test("hook pipeline: start -> 3 tool calls -> prompt -> finish produces publishable transcript", async () => {
  const origSessionDir = ".session";
  const backup = existsSync(origSessionDir) ? mkdtempSync(join(tmpdir(), "sess-backup-")) : null;
  if (backup) execFileSync("cp", ["-a", origSessionDir, backup]);

  try {
    execFileSync("rm", [
      "-rf",
      ".session/active-animation-build",
      ".session/animation-transcripts",
      ".session/animation-renders",
    ]);

    sh(".claude/hooks/start-animation-build.sh integration-test");
    sh(
      ".claude/hooks/post-tool-use-animation.sh",
      JSON.stringify({
        tool_name: "Read",
        tool_input: { file_path: "x" },
        tool_response: { content: "y" },
      }),
    );
    sh(
      ".claude/hooks/post-tool-use-animation.sh",
      JSON.stringify({
        tool_name: "Write",
        tool_input: {
          file_path: "src/animations/integration-test/index.astro",
          content: "hello",
        },
        tool_response: {},
      }),
    );
    sh(
      ".claude/hooks/user-prompt-submit-animation.sh",
      JSON.stringify({ prompt: "Add easing" }),
    );
    sh(
      ".claude/hooks/post-tool-use-animation.sh",
      JSON.stringify({
        tool_name: "Edit",
        tool_input: {
          file_path: "src/animations/integration-test/index.astro",
          old_string: "hello",
          new_string: "hello world",
        },
        tool_response: {},
      }),
    );
    sh(".claude/hooks/finish-animation-build.sh");

    const lsOut = sh("ls .session/animation-transcripts/").trim();
    const descName = lsOut.split("\n").find((l) => l.endsWith(".session.json"));
    assert.ok(descName, "descriptor exists");
    const descPath = join(".session/animation-transcripts", descName!);
    const desc = JSON.parse(readFileSync(descPath, "utf8"));
    assert.equal(desc.slug, "integration-test");
    assert.equal(desc.toolCallCount, 4);

    const transcriptPath = descPath.replace(".session.json", ".jsonl");
    const lines = readFileSync(transcriptPath, "utf8").trim().split("\n");
    assert.equal(lines.length, 4, "4 transcript entries (3 tool + 1 prompt)");

    const prepared = await prepareSession({
      slug: desc.slug,
      sessionId: desc.sessionId,
      transcriptLines: lines,
      repoRoot: process.cwd(),
    });
    assert.equal(prepared.toolCallCount, 3);
    assert.ok(prepared.sourceHistory.cursors, "source history computed");
    assert.ok(prepared.transcriptGz.byteLength > 0);
  } finally {
    execFileSync("rm", [
      "-rf",
      ".session/active-animation-build",
      ".session/animation-transcripts",
      ".session/animation-renders",
    ]);
    if (backup) {
      execFileSync("cp", ["-a", `${backup}/.session/.`, ".session/"]);
      rmSync(backup, { recursive: true, force: true });
    }
  }
});
