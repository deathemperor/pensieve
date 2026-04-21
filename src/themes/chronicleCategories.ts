/**
 * Chronicle category definitions — the 7 event types that appear in the
 * Celestial Chronicle. Each category owns one accent hex (reused from the
 * site palette where possible), a ledger glyph, and bilingual labels.
 */

export interface ChronicleCategory {
  slug: string;
  hex: string;
  label_en: string;
  label_vi: string;
  symbol: string;
}

export const chronicleCategories: readonly ChronicleCategory[] = [
  { slug: "milestone", hex: "#d4a843", label_en: "Milestone", label_vi: "Cột mốc",   symbol: "✦" },
  { slug: "family",    hex: "#5e6ad2", label_en: "Family",    label_vi: "Gia đình",  symbol: "✦" },
  { slug: "work",      hex: "#3fb950", label_en: "Work",      label_vi: "Công việc", symbol: "✦" },
  { slug: "loss",      hex: "#b54b3c", label_en: "Loss",      label_vi: "Mất mát",   symbol: "●" },
  { slug: "love",      hex: "#c678dd", label_en: "Love",      label_vi: "Tình yêu",  symbol: "✦" },
  { slug: "travel",    hex: "#2aa198", label_en: "Travel",    label_vi: "Chuyến đi", symbol: "✧" },
  { slug: "threshold", hex: "#f7a65a", label_en: "Threshold", label_vi: "Ngưỡng cửa",symbol: "✦" },
];

export const CHRONICLE_CATEGORY_SLUGS: readonly string[] = chronicleCategories.map((c) => c.slug);

export function getChronicleCategory(slug: string | undefined | null): ChronicleCategory {
  const found = chronicleCategories.find((c) => c.slug === slug);
  return found ?? chronicleCategories[0]; // fallback: milestone
}
