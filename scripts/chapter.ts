#!/usr/bin/env -S node --import tsx
import { execFileSync } from "node:child_process";

export interface AddArgs {
  sessionId: string;
  cursorIndex: number;
  label: string;
  description?: string;
  sortOrder: number;
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

export function buildAddSql(a: AddArgs): string {
  const id = `ch_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const now = new Date().toISOString();
  const desc = a.description ?? "";
  return `INSERT INTO animation_chapters
    (id, session_id, cursor_index, label, description, sort_order, created_at)
    VALUES ('${id}', '${esc(a.sessionId)}', ${a.cursorIndex}, '${esc(a.label)}', '${esc(desc)}', ${a.sortOrder}, '${now}')`;
}

export function buildListSql(sessionId: string): string {
  return `SELECT id, cursor_index, label, description, sort_order FROM animation_chapters
    WHERE session_id = '${esc(sessionId)}' ORDER BY sort_order ASC`;
}

function parseFlags(): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < process.argv.length - 1; i++) {
    const a = process.argv[i];
    if (a.startsWith("--")) flags[a.slice(2)] = process.argv[i + 1] ?? "";
  }
  return flags;
}

function run(sql: string): void {
  execFileSync(
    "npx",
    [
      "wrangler", "d1", "execute", "pensieve-db", "--remote",
      "--command", sql,
    ],
    { stdio: "inherit" },
  );
}

function usage(): void {
  console.error(`usage:
  chapter add --session <id> --at <cursor> --label "v2 easing" [--note "..."] [--order N]
  chapter list --session <id>
  chapter remove --id <chapter-id>`);
}

async function main(): Promise<void> {
  const [, , cmd] = process.argv;
  const flags = parseFlags();

  if (cmd === "add") {
    const args: AddArgs = {
      sessionId: flags.session,
      cursorIndex: parseInt(flags.at, 10),
      label: flags.label,
      description: flags.note,
      sortOrder: flags.order ? parseInt(flags.order, 10) : Math.floor(Date.now() / 1000),
    };
    if (!args.sessionId || isNaN(args.cursorIndex) || !args.label) {
      usage();
      process.exit(1);
    }
    run(buildAddSql(args));
    console.error(`chapter added: ${args.label} @ cursor ${args.cursorIndex}`);
  } else if (cmd === "list") {
    if (!flags.session) {
      usage();
      process.exit(1);
    }
    run(buildListSql(flags.session));
  } else if (cmd === "remove") {
    if (!flags.id) {
      usage();
      process.exit(1);
    }
    run(`DELETE FROM animation_chapters WHERE id = '${esc(flags.id)}'`);
  } else {
    usage();
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("chapter failed:", e);
    process.exit(2);
  });
}
