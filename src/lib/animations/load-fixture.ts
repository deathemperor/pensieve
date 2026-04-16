import { readFileSync } from "node:fs";
import { parseTranscript, type TranscriptEntry } from "./transcript.ts";

export interface FixtureChapter {
  cursor_index: number;
  label: string;
  description?: string;
}

export interface LoadedFixture {
  transcript: TranscriptEntry[];
  chapters: FixtureChapter[];
}

export function loadFixture(slug: string): LoadedFixture {
  const base = `src/fixtures/animations/${slug}`;
  const transcript = parseTranscript(
    readFileSync(`${base}/transcript.jsonl`, "utf8"),
  );
  const chapters = JSON.parse(
    readFileSync(`${base}/chapters.json`, "utf8"),
  ) as FixtureChapter[];
  return { transcript, chapters };
}
