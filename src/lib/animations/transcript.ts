export type TranscriptEntry =
  | { cursor: number; ts: string; kind: "prompt"; content: string }
  | { cursor: number; ts: string; kind: "assistant"; content: string }
  | {
      cursor: number;
      ts: string;
      kind: "tool";
      tool: string;
      input: unknown;
      output: unknown;
    };

export type TranscriptKind = TranscriptEntry["kind"];

export function parseTranscript(jsonlText: string): TranscriptEntry[] {
  return jsonlText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TranscriptEntry);
}

export function filterByKinds(
  entries: TranscriptEntry[],
  kinds: TranscriptKind[],
): TranscriptEntry[] {
  const allow = new Set(kinds);
  return entries.filter((e) => allow.has(e.kind));
}

export function findEntryAtCursor(
  entries: TranscriptEntry[],
  cursor: number,
): TranscriptEntry | undefined {
  return entries.find((e) => e.cursor === cursor);
}
