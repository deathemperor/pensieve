import { parseTranscript, type TranscriptEntry } from "./transcript.ts";

// Vite raw imports — fixtures inline at build time. Cloudflare Workers
// has no filesystem at runtime, so fs.readFileSync doesn't work.
import placeholderTranscript from "../../fixtures/animations/placeholder/transcript.jsonl?raw";
import placeholderChapters from "../../fixtures/animations/placeholder/chapters.json";

export interface FixtureChapter {
  cursor_index: number;
  label: string;
  description?: string;
}

export interface LoadedFixture {
  transcript: TranscriptEntry[];
  chapters: FixtureChapter[];
}

const FIXTURES: Record<string, { raw: string; chapters: FixtureChapter[] }> = {
  placeholder: {
    raw: placeholderTranscript,
    chapters: placeholderChapters as FixtureChapter[],
  },
};

export function loadFixture(slug: string): LoadedFixture {
  const f = FIXTURES[slug];
  if (!f) {
    return { transcript: [], chapters: [] };
  }
  return {
    transcript: parseTranscript(f.raw),
    chapters: f.chapters,
  };
}

export function hasFixture(slug: string): boolean {
  return slug in FIXTURES;
}
