import { describe, expect, it } from "vitest";
import type { NormalizedReviewRow } from "@/types/normalized";
import {
  computeNegativeKeywords,
  computePositiveKeywords,
  summarizeReviewKeywordInsights,
} from "@/lib/analysis/reviews";

function reviewRow(overrides: Partial<NormalizedReviewRow>): NormalizedReviewRow {
  return {
    productId: "1",
    productName: "테스트 상품",
    rating: 5,
    hasPhoto: false,
    content: null,
    helpfulCount: 0,
    reviewDate: "2026-06-01",
    hasReply: false,
    replyDate: null,
    ...overrides,
  };
}

describe("computePositiveKeywords / computeNegativeKeywords", () => {
  const rows: NormalizedReviewRow[] = [
    reviewRow({ rating: 5, content: "접착력 최고예요 계속 재구매할게요" }),
    reviewRow({ rating: 4, content: "접착력 좋고 편해요" }),
    reviewRow({ rating: 5, content: "가성비 최고 재구매의사 있습니다" }),
    reviewRow({ rating: 1, content: "접착력이 약해서 자꾸 떨어져요" }),
    reviewRow({ rating: 2, content: "접착력이 별로라 실망했어요" }),
    reviewRow({ rating: 3, content: "배송은 빠른데 접착력이 아쉬워요" }),
  ];

  it("only counts words from the positive rating band (4~5) for positive keywords", () => {
    const positive = computePositiveKeywords(rows, 10);
    expect(positive.find((k) => k.word === "접착력")?.count).toBe(2);
    // "접착력이" (rating<=3 rows) must not leak into the positive band's count for "접착력".
  });

  it("only counts words from the negative rating band (1~3) for negative keywords", () => {
    const negative = computeNegativeKeywords(rows, 10);
    expect(negative.find((k) => k.word === "접착력이")?.count).toBe(3);
    expect(negative.find((k) => k.word === "접착력")).toBeUndefined();
  });

  it("attaches real review excerpts as examples, not fabricated text", () => {
    const negative = computeNegativeKeywords(rows, 10);
    const entry = negative.find((k) => k.word === "접착력이")!;
    expect(entry.examples.length).toBeGreaterThan(0);
    for (const example of entry.examples) {
      expect(rows.some((r) => r.content === example)).toBe(true);
    }
  });

  it("summarizeReviewKeywordInsights produces grounded 강화/보완 bullets referencing real counts", () => {
    const positive = computePositiveKeywords(rows, 5);
    const negative = computeNegativeKeywords(rows, 5);
    const summary = summarizeReviewKeywordInsights(positive, negative);

    expect(summary.strengths.length).toBeGreaterThan(0);
    expect(summary.improvements.length).toBeGreaterThan(0);
    expect(summary.improvements[0]).toContain("접착력이");
    expect(summary.improvements[0]).toContain("3건");
  });

  it("returns empty results when there are no reviews in a band", () => {
    const onlyPositive: NormalizedReviewRow[] = [reviewRow({ rating: 5, content: "완벽해요" })];
    expect(computeNegativeKeywords(onlyPositive, 10)).toEqual([]);
  });
});
