// src/lib/hol/slug.ts
//
// Port of hol/parse/slug.py: strip Vietnamese diacritics and produce a
// URL-safe lowercase slug. Unicode NFD decomposition + combining-mark
// removal handles Vietnamese composed forms correctly.

export function viSlug(input: string): string {
  if (!input) return "";
  const stripped = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // combining diacritics
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return stripped;
}
