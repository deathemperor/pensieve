import { createHash } from "node:crypto";
import type { RawEntry } from "./redact-transcript.ts";

export type RedactedEntry = RawEntry & {
  postStateChecksum?: Record<string, string>;
};

export interface SourceHistoryCursor {
  cursor: number;
  files: Record<string, string>;
}

export interface SourceHistory {
  slugPrefix: string;
  cursors: Record<number, SourceHistoryCursor>;
}

export interface BuildOptions {
  verifyChecksums?: boolean;
}

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function applyEdit(prev: string | undefined, oldStr: string, newStr: string): string {
  if (prev === undefined) return newStr;
  const idx = prev.indexOf(oldStr);
  if (idx < 0) return prev;
  return prev.slice(0, idx) + newStr + prev.slice(idx + oldStr.length);
}

export function buildSourceHistory(
  entries: RedactedEntry[],
  slugPrefix: string,
  opts: BuildOptions = {},
): SourceHistory {
  const state: Record<string, string> = {};
  const history: SourceHistory = { slugPrefix, cursors: {} };

  for (const entry of entries) {
    if (entry.kind !== "tool") continue;
    if (entry.tool !== "Write" && entry.tool !== "Edit") continue;

    const input = entry.input as Record<string, unknown>;
    const filePath = typeof input.file_path === "string" ? input.file_path : undefined;
    if (!filePath || !filePath.startsWith(slugPrefix)) continue;

    if (entry.tool === "Write") {
      const content = typeof input.content === "string" ? input.content : "";
      state[filePath] = content;
    } else {
      const oldStr = typeof input.old_string === "string" ? input.old_string : "";
      const newStr = typeof input.new_string === "string" ? input.new_string : "";
      state[filePath] = applyEdit(state[filePath], oldStr, newStr);
    }

    if (opts.verifyChecksums && entry.postStateChecksum) {
      const expected = entry.postStateChecksum[filePath];
      const actual = sha(state[filePath]);
      if (expected && expected !== actual) {
        throw new Error(
          `checksum mismatch at cursor ${entry.cursor} for ${filePath}: expected ${expected.slice(0, 12)}..., got ${actual.slice(0, 12)}...`,
        );
      }
    }

    history.cursors[entry.cursor] = {
      cursor: entry.cursor,
      files: { ...state },
    };
  }

  return history;
}

export function reconstructStateAt(
  history: SourceHistory,
  cursor: number,
): Record<string, string> {
  const keys = Object.keys(history.cursors)
    .map(Number)
    .filter((c) => c <= cursor)
    .sort((a, b) => a - b);
  const last = keys[keys.length - 1];
  return last === undefined ? {} : history.cursors[last].files;
}
