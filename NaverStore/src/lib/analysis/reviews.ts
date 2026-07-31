import type { NormalizedReviewRow } from "@/types/normalized";
import { isWithinRange, type DateRange } from "../metrics/period";

export function filterReviewsByRange(rows: NormalizedReviewRow[], range: DateRange): NormalizedReviewRow[] {
  return rows.filter((r) => r.reviewDate !== null && isWithinRange(r.reviewDate, range));
}

export interface ReviewSummary {
  count: number;
  averageRating: number | null;
  /** Ratio of reviews with rating <= 3 — the doc's headline quality signal. */
  lowRatingShare: number | null;
  photoShare: number | null;
  replyRate: number | null;
  averageReplyDays: number | null;
}

export function computeReviewSummary(rows: NormalizedReviewRow[]): ReviewSummary {
  if (rows.length === 0) {
    return { count: 0, averageRating: null, lowRatingShare: null, photoShare: null, replyRate: null, averageReplyDays: null };
  }

  const rated = rows.filter((r) => r.rating !== null);
  const averageRating = rated.length > 0 ? rated.reduce((s, r) => s + (r.rating as number), 0) / rated.length : null;
  const lowRatingShare = rated.length > 0 ? rated.filter((r) => (r.rating as number) <= 3).length / rated.length : null;
  const photoShare = rows.filter((r) => r.hasPhoto).length / rows.length;
  const replyRate = rows.filter((r) => r.hasReply).length / rows.length;

  const replyDurations: number[] = [];
  for (const r of rows) {
    if (r.hasReply && r.reviewDate && r.replyDate) {
      const days = (new Date(r.replyDate).getTime() - new Date(r.reviewDate).getTime()) / 86_400_000;
      if (days >= 0) replyDurations.push(days);
    }
  }
  const averageReplyDays =
    replyDurations.length > 0 ? replyDurations.reduce((a, b) => a + b, 0) / replyDurations.length : null;

  return { count: rows.length, averageRating, lowRatingShare, photoShare, replyRate, averageReplyDays };
}

export interface RatingBucket {
  rating: number;
  count: number;
}

export function computeRatingDistribution(rows: NormalizedReviewRow[]): RatingBucket[] {
  const buckets = [1, 2, 3, 4, 5].map((rating) => ({ rating, count: 0 }));
  for (const r of rows) {
    if (r.rating === null) continue;
    const bucket = buckets.find((b) => b.rating === Math.round(r.rating as number));
    if (bucket) bucket.count++;
  }
  return buckets;
}

const STOPWORDS = new Set([
  "너무", "정말", "진짜", "그냥", "제품", "상품", "구매", "사용", "좋아요", "같아요",
  "합니다", "했어요", "해서", "이건", "저는", "제가", "정도", "같은", "이거", "조금",
  "엄청", "완전", "진짜로", "근데", "그리고", "있는데", "있어요", "없어요", "하는데",
  "만족", "만족합니다", "만족해요", "빠른", "배송", "빠른배송", "기대가됩니다", "기대돼요",
  "받았어요", "잘받았어요", "좋습니다", "좋은것", "괜찮아요", "감사합니다", "추천합니다",
  "아직", "생각보다", "처음", "다시", "그런지", "있는", "됐어요", "여기에",
]);

function tokenize(text: string): string[] {
  return text
    .replace(/[.,!?~^;:()"'\n\r]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

export interface ProductProblemSummary {
  productId: string;
  productName: string;
  reviewCount: number;
  averageRating: number | null;
  lowRatingCount: number;
  /** Word-frequency counts from low-rating review text — a surfacing signal, not a claimed root cause. */
  topComplaintWords: string[];
}

export interface KeywordFrequency {
  word: string;
  count: number;
  /** A couple of real review excerpts containing the word, so a consultant can check the actual context (design doc 3.5). */
  examples: string[];
}

interface RatingBand {
  minRating: number;
  maxRating: number;
}

function reviewsInBand(rows: NormalizedReviewRow[], band: RatingBand): NormalizedReviewRow[] {
  return rows.filter((r) => r.rating !== null && r.rating >= band.minRating && r.rating <= band.maxRating && r.content);
}

function computeKeywordFrequencies(rows: NormalizedReviewRow[], band: RatingBand, topN: number, exampleCount: number): KeywordFrequency[] {
  const bandRows = reviewsInBand(rows, band);
  const wordCounts = new Map<string, number>();
  for (const r of bandRows) {
    for (const word of tokenize(r.content as string)) {
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }
  }

  return [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => {
      const examples: string[] = [];
      for (const r of bandRows) {
        if (examples.length >= exampleCount) break;
        if (tokenize(r.content as string).includes(word)) examples.push(r.content as string);
      }
      return { word, count, examples };
    });
}

/** 좋은 후기(평점 4~5)에서 자주 등장한 단어. */
export function computePositiveKeywords(rows: NormalizedReviewRow[], topN = 10): KeywordFrequency[] {
  return computeKeywordFrequencies(rows, { minRating: 4, maxRating: 5 }, topN, 2);
}

/** 안좋은 후기(평점 1~3)에서 자주 등장한 단어. */
export function computeNegativeKeywords(rows: NormalizedReviewRow[], topN = 10): KeywordFrequency[] {
  return computeKeywordFrequencies(rows, { minRating: 1, maxRating: 3 }, topN, 2);
}

export interface ReviewKeywordInsights {
  /** 강화할 점 — reinforce what's already working. */
  strengths: string[];
  /** 보완할 점 — address what keeps coming up as a complaint. */
  improvements: string[];
}

/**
 * Purely frequency-based bullets grounded in the store's own positive/negative
 * keyword lists — labels a word as a strength/weakness only because it's the
 * store's own customers' own words in that rating band, not an inferred cause
 * (design doc 3.5: no unfounded claims, no invented root causes).
 */
export function summarizeReviewKeywordInsights(
  positive: KeywordFrequency[],
  negative: KeywordFrequency[],
  topN = 5
): ReviewKeywordInsights {
  return {
    strengths: positive
      .slice(0, topN)
      .map((k) => `'${k.word}' 관련 긍정 언급이 ${k.count}건으로 많습니다. 상세페이지·마케팅 메시지에서 이 강점을 강조해 보세요.`),
    improvements: negative
      .slice(0, topN)
      .map((k) => `'${k.word}' 관련 부정 언급이 ${k.count}건 반복됩니다. 우선적으로 원인을 확인하고 개선을 검토하세요.`),
  };
}

export interface ReviewNarrative {
  paragraphs: string[];
}

function formatPercent(ratio: number | null): string {
  return ratio !== null ? `${(ratio * 100).toFixed(1)}%` : "확인 불가";
}

function formatKeywordList(items: KeywordFrequency[], topN: number): string {
  return items
    .slice(0, topN)
    .map((k) => `'${k.word}'(${k.count}건)`)
    .join(", ");
}

/**
 * Longer-form prose diagnosis for the reviews tab, built strictly from the same
 * computed numbers as the chip/bullet sections above — no inferred causes, only
 * what the review text and rating distribution themselves show (design doc 3.5).
 */
export function buildReviewNarrative(
  summary: ReviewSummary,
  positive: KeywordFrequency[],
  negative: KeywordFrequency[],
  problems: ProductProblemSummary[]
): ReviewNarrative {
  if (summary.count === 0) {
    return { paragraphs: ["선택한 기간에 등록된 리뷰가 없어 종합 진단을 제공할 수 없습니다."] };
  }

  const paragraphs: string[] = [];

  const ratingText =
    summary.averageRating !== null ? `평균 평점은 ${summary.averageRating.toFixed(2)}점입니다` : "평균 평점은 확인할 수 없습니다";
  paragraphs.push(
    `선택한 기간 동안 등록된 리뷰는 총 ${summary.count.toLocaleString()}건이며, ${ratingText}. ` +
      `이 중 1~3점 저평점 비중은 ${formatPercent(summary.lowRatingShare)}, 포토리뷰 비중은 ${formatPercent(
        summary.photoShare
      )}, 판매자 답글률은 ${formatPercent(summary.replyRate)}로 집계됩니다.` +
      (summary.averageReplyDays !== null ? ` 답글이 달린 리뷰의 평균 응답 소요일은 ${summary.averageReplyDays.toFixed(1)}일입니다.` : "")
  );

  if (positive.length > 0) {
    paragraphs.push(
      `긍정 후기(평점 4~5점)에서는 ${formatKeywordList(positive, 5)} 등의 단어가 자주 등장했습니다. ` +
        `고객이 반복적으로 언급한 표현인 만큼, 상세페이지나 마케팅 메시지에서 이 강점을 그대로 인용해 강조하면 신규 고객에게 신뢰를 주는 데 도움이 될 수 있습니다.`
    );
  } else {
    paragraphs.push("긍정 후기로 분류할 만한 4~5점 리뷰 텍스트가 충분하지 않아, 강점 키워드는 이번 기간에는 확인되지 않았습니다.");
  }

  const repeatedProducts = problems.filter((p) => p.lowRatingCount >= 2).slice(0, 3);
  if (negative.length > 0) {
    const productClause =
      repeatedProducts.length > 0
        ? ` 특히 ${repeatedProducts.map((p) => p.productName).join(", ")} 상품에서 저평점 리뷰가 반복적으로 확인되어, 이 단어들과의 연관성을 우선 살펴볼 필요가 있습니다.`
        : "";
    paragraphs.push(
      `반면 부정 후기(평점 1~3점)에서는 ${formatKeywordList(negative, 5)} 등의 단어가 반복적으로 나타났습니다.${productClause} ` +
        `다만 이는 단어 등장 빈도를 집계한 결과일 뿐 실제 원인을 특정한 것은 아니므로, 리뷰 원문을 직접 확인해 정확한 원인을 판단해야 합니다.`
    );
  } else {
    paragraphs.push("부정 후기로 분류할 만한 1~3점 리뷰 텍스트가 충분하지 않아, 이번 기간에는 반복되는 불만 키워드가 확인되지 않았습니다.");
  }

  if (positive.length > 0 || negative.length > 0) {
    const positiveTotal = positive.reduce((sum, k) => sum + k.count, 0);
    const negativeTotal = negative.reduce((sum, k) => sum + k.count, 0);
    const balanceClause =
      positiveTotal > negativeTotal
        ? "긍정 언급 건수가 부정 언급 건수보다 많아, 전반적인 후기 반응은 우호적인 편으로 보입니다."
        : positiveTotal < negativeTotal
          ? "부정 언급 건수가 긍정 언급 건수보다 많아, 반복되는 불만 요인을 우선 점검할 필요가 있습니다."
          : "긍정 언급과 부정 언급 건수가 비슷한 수준으로, 강점과 개선점이 함께 존재하는 것으로 보입니다.";
    paragraphs.push(
      `종합적으로 볼 때, 집계된 긍정 키워드 언급은 총 ${positiveTotal}건, 부정 키워드 언급은 총 ${negativeTotal}건입니다. ${balanceClause} ` +
        "이 진단은 리뷰 텍스트의 단어 빈도와 평점 분포만을 근거로 한 것이므로, 실제 의사결정 전에는 반드시 원문 리뷰와 상품별 상세 데이터를 함께 확인하시기 바랍니다."
    );
  }

  return { paragraphs };
}

export function computeProductProblems(rows: NormalizedReviewRow[], minReviews = 3): ProductProblemSummary[] {
  const byProduct = new Map<string, NormalizedReviewRow[]>();
  for (const r of rows) {
    const list = byProduct.get(r.productId) ?? [];
    list.push(r);
    byProduct.set(r.productId, list);
  }

  const summaries: ProductProblemSummary[] = [];
  for (const [productId, productRows] of byProduct) {
    if (productRows.length < minReviews) continue;

    const rated = productRows.filter((r) => r.rating !== null);
    const averageRating = rated.length > 0 ? rated.reduce((s, r) => s + (r.rating as number), 0) / rated.length : null;
    const lowRatingRows = rated.filter((r) => (r.rating as number) <= 3);

    const wordCounts = new Map<string, number>();
    for (const r of lowRatingRows) {
      if (!r.content) continue;
      for (const word of tokenize(r.content)) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }
    const topComplaintWords = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    summaries.push({
      productId,
      productName: productRows[0].productName,
      reviewCount: productRows.length,
      averageRating,
      lowRatingCount: lowRatingRows.length,
      topComplaintWords,
    });
  }

  return summaries.sort((a, b) => (a.averageRating ?? 5) - (b.averageRating ?? 5));
}
