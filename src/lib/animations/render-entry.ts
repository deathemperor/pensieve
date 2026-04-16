import type { TranscriptEntry } from "./transcript.ts";

export function renderEntryLabel(entry: TranscriptEntry): string {
  switch (entry.kind) {
    case "prompt":
      return `prompt · ${truncate(entry.content, 60)}`;
    case "assistant":
      return `assistant · ${truncate(entry.content, 60)}`;
    case "tool": {
      const firstArg = firstScalarArg(entry.input);
      return firstArg ? `${entry.tool} · ${firstArg}` : entry.tool;
    }
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function firstScalarArg(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  for (const v of Object.values(input as Record<string, unknown>)) {
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}
