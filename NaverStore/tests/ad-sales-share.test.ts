import { describe, expect, it } from "vitest";
import { computeAdSalesSplit } from "@/lib/metrics/ad-sales-share";

describe("computeAdSalesSplit", () => {
  it("splits net sales into organic vs ad-attributed shares that sum to 100%", () => {
    // netSales 27,743,190 / adSales 18,869,640 matches the real-fixture numbers used elsewhere.
    const split = computeAdSalesSplit(27_743_190, 18_869_640)!;
    expect(split.organicSales).toBe(27_743_190 - 18_869_640);
    expect(split.adSales).toBe(18_869_640);
    expect(split.organicShare + split.adShare).toBeCloseTo(100);
    expect(split.adShare).toBeCloseTo((18_869_640 / 27_743_190) * 100);
  });

  it("returns null when either input is missing", () => {
    expect(computeAdSalesSplit(null, 1000)).toBeNull();
    expect(computeAdSalesSplit(1000, null)).toBeNull();
  });

  it("returns null when net sales is zero or negative", () => {
    expect(computeAdSalesSplit(0, 0)).toBeNull();
    expect(computeAdSalesSplit(-100, 0)).toBeNull();
  });

  it("returns null when ad-attributed sales alone would exceed net sales (organic would go negative)", () => {
    expect(computeAdSalesSplit(1000, 1500)).toBeNull();
  });

  it("handles no ad-attributed sales as a 100:0 split", () => {
    const split = computeAdSalesSplit(1_000_000, 0)!;
    expect(split.organicShare).toBeCloseTo(100);
    expect(split.adShare).toBe(0);
  });
});
