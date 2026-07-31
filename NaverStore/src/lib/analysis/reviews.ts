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
