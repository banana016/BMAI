import { describe, expect, it } from "vitest";
import { computeAdLinkedSalesShare } from "@/lib/metrics/ad-sales-share";

describe("computeAdLinkedSalesShare", () => {
  it("computes ad-attributed sales as a share of organic (non-ad) sales", () => {
    // netSales 27,743,190 / adSales 18,869,640 matches the real-fixture numbers used elsewhere.
    const share = computeAdLinkedSalesShare(27_743_190, 18_869_640);
    const organic = 27_743_190 - 18_869_640;
    expect(share).toBeCloseTo((18_869_640 / organic) * 100);
  });

  it("returns null when either input is missing", () => {
    expect(computeAdLinkedSalesShare(null, 1000)).toBeNull();
    expect(computeAdLinkedSalesShare(1000, null)).toBeNull();
  });

  it("returns null instead of a nonsensical ratio when organic sales is zero or negative", () => {
    expect(computeAdLinkedSalesShare(1000, 1000)).toBeNull();
    expect(computeAdLinkedSalesShare(1000, 1500)).toBeNull();
  });

  it("returns 0 when there's no ad-attributed sales at all", () => {
    expect(computeAdLinkedSalesShare(1_000_000, 0)).toBe(0);
  });
});
