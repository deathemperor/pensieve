import type { TierCode } from "./types";
import type { Lang } from "../../utils/lang";

export function tierName(tier: TierCode, lang: Lang): string {
  if (lang === "vi") {
    return (
      { S: "Người khai lập", A: "Hiệu trưởng", B: "Giáo sư", C: "Học giả", D: "Khách" } as const
    )[tier];
  }
  return (
    { S: "Founder", A: "Headmaster", B: "Professor", C: "Scholar", D: "Visitor" } as const
  )[tier];
}

export function tierSectionTitle(
  tier: TierCode,
  lang: Lang,
): { title: string; subtitle: string } {
  if (lang === "vi") {
    return (
      {
        S: { title: "Đại sảnh", subtitle: "Người khai lập" },
        A: { title: "Hiệu trưởng", subtitle: "" },
        B: { title: "Giáo sư", subtitle: "" },
        C: { title: "Học giả", subtitle: "" },
        D: { title: "Hành lang", subtitle: "Khách" },
      } as const
    )[tier];
  }
  return (
    {
      S: { title: "Main Hall", subtitle: "Founders" },
      A: { title: "Headmasters", subtitle: "" },
      B: { title: "Professors", subtitle: "" },
      C: { title: "Scholars", subtitle: "" },
      D: { title: "Corridor", subtitle: "Visitors" },
    } as const
  )[tier];
}
