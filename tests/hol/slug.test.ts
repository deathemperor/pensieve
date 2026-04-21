import { describe, expect, it } from "vitest";
import { viSlug } from "../../src/lib/hol/slug";

describe("viSlug", () => {
  it("strips Vietnamese diacritics", () => {
    expect(viSlug("Tâm sự")).toBe("tam-su");
    expect(viSlug("giao tiếp")).toBe("giao-tiep");
    expect(viSlug("Những ngày mưa")).toBe("nhung-ngay-mua");
  });
  it("keeps numbers", () => {
    expect(viSlug("Chuyện lớp 12A3")).toBe("chuyen-lop-12a3");
  });
  it("collapses whitespace + punctuation", () => {
    expect(viSlug("  Hello,  World!  ")).toBe("hello-world");
  });
  it("returns empty for empty", () => {
    expect(viSlug("")).toBe("");
  });
});
