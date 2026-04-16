import { test } from "node:test";
import assert from "node:assert/strict";
import {
  redactEntry,
  type RawEntry,
  type RedactionOptions,
} from "../../scripts/redact-transcript.ts";

const OPTS: RedactionOptions = {
  repoRoot: "/Users/deathemperor/death/pensieve",
  allowlistPrefixes: ["src/animations/", "public/"],
  allowlistExtensions: [".md", ".txt", ".astro", ".ts"],
};

test("redactEntry normalizes absolute repo paths", () => {
  const entry: RawEntry = {
    cursor: 0,
    ts: "2026-04-16T09:00:00Z",
    kind: "tool",
    tool: "Edit",
    input: { file_path: "/Users/deathemperor/death/pensieve/src/animations/x/index.astro" },
    output: {},
  };
  const out = redactEntry(entry, OPTS);
  assert.ok(out.kind === "tool");
  assert.equal(
    (out.input as { file_path: string }).file_path,
    "<repo>/src/animations/x/index.astro",
  );
});

test("redactEntry scrubs GitHub tokens", () => {
  const entry: RawEntry = {
    cursor: 1,
    ts: "t",
    kind: "tool",
    tool: "Bash",
    input: { command: "export GH_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789" },
    output: { stdout: "" },
  };
  const out = redactEntry(entry, OPTS);
  const cmd = (out.input as { command: string }).command;
  assert.match(cmd, /\[REDACTED:token\]/);
  assert.doesNotMatch(cmd, /ghp_/);
});

test("redactEntry scrubs API-key env assignments", () => {
  const entry: RawEntry = {
    cursor: 2,
    ts: "t",
    kind: "tool",
    tool: "Bash",
    input: { command: "export OPENAI_API_KEY=sk-proj-abc123xyz789" },
    output: {},
  };
  const out = redactEntry(entry, OPTS);
  const cmd = (out.input as { command: string }).command;
  assert.match(cmd, /OPENAI_API_KEY=\[REDACTED:token\]/);
});

test("redactEntry drops file contents outside the allowlist", () => {
  const entry: RawEntry = {
    cursor: 3,
    ts: "t",
    kind: "tool",
    tool: "Read",
    input: { file_path: "/Users/deathemperor/death/pensieve/.env.local" },
    output: { content: "DATABASE_URL=postgres://u:pw@host/db" },
  };
  const out = redactEntry(entry, OPTS);
  assert.equal(
    (out.output as { content: string }).content,
    "[REDACTED:env-contents]",
  );
});

test("redactEntry leaves innocuous code intact", () => {
  const entry: RawEntry = {
    cursor: 4,
    ts: "t",
    kind: "tool",
    tool: "Write",
    input: {
      file_path: "/Users/deathemperor/death/pensieve/src/animations/demo/index.astro",
      content: "<div class=\"stage\">hello</div>",
    },
    output: {},
  };
  const out = redactEntry(entry, OPTS);
  assert.match((out.input as { content: string }).content, /hello/);
});

test("redactEntry passes prompt entries through with path normalization", () => {
  const entry: RawEntry = {
    cursor: 5,
    ts: "t",
    kind: "prompt",
    content:
      "Edit /Users/deathemperor/death/pensieve/src/animations/demo/index.astro to add orbit.",
  };
  const out = redactEntry(entry, OPTS);
  assert.ok(out.kind === "prompt");
  assert.match(out.content, /<repo>\/src\/animations/);
});
