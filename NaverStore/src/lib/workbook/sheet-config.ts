import type { SheetKey } from "@/types/workbook";

export interface SheetConfig {
  key: SheetKey;
  expectedName: string;
  /** 1-indexed row number where the header is expected to live (fast path). */
  expectedHeaderRow: number;
  /** 1-indexed inclusive row range to scan if the fast path doesn't match. */
  headerSearchWindow: [number, number];
  headerTokens: string[];
  /** Only enforced for sheets where the design doc names required columns explicitly. */
  requiredColumns?: string[];
  /** Header text(s) to look for when locating the date column, checked in order. */
  dateColumnCandidates: string[];
  /** Fraction of headerTokens that must match for a row to count as the header. */
  matchThreshold: number;
}

export const OVERVIEW_SHEET_NAME = "스토어 오버뷰";

export const SHEET_CONFIGS: SheetConfig[] = [
  {
    key: "sales",
    expectedName: "판매분석",
    expectedHeaderRow: 20,
    headerSearchWindow: [15, 25],
    headerTokens: [
      "날짜",
      "채널",
      "상품결제건수",
      "판매금액(총)",
      "판매금액(순)",
      "상품결제단가",
      "방문수",
      "구매전환율",
    ],
    requiredColumns: [
      "날짜",
      "채널",
      "상품결제건수",
      "판매금액(총)",
      "판매금액(순)",
      "상품결제단가",
      "방문수",
      "구매전환율",
    ],
    dateColumnCandidates: ["날짜"],
    matchThreshold: 0.7,
  },
  {
    key: "traffic",
    expectedName: "방문분석",
    expectedHeaderRow: 21,
    headerSearchWindow: [16, 26],
    headerTokens: [
      "날짜",
      "경로(1단계)",
      "경로(2단계)",
      "경로(3단계)",
      "방문수",
      "상품결제건수",
      "구매전환율",
      "판매금액(총)",
    ],
    requiredColumns: [
      "날짜",
      "경로(1단계)",
      "경로(2단계)",
      "경로(3단계)",
      "방문수",
      "상품결제건수",
      "구매전환율",
      "판매금액(총)",
    ],
    dateColumnCandidates: ["날짜"],
    matchThreshold: 0.7,
  },
  {
    key: "search",
    expectedName: "검색분석",
    expectedHeaderRow: 17,
    headerSearchWindow: [12, 22],
    headerTokens: ["날짜", "검색어", "방문수", "상품결제건수", "구매전환율", "판매금액(총)", "상품결제단가"],
    dateColumnCandidates: ["날짜"],
    matchThreshold: 0.7,
  },
  {
    key: "customers",
    expectedName: "고객분석",
    expectedHeaderRow: 15,
    headerSearchWindow: [10, 20],
    // Only "날짜" and "고객분류" are named in the design doc; require both since the list is short.
    headerTokens: ["날짜", "고객분류"],
    dateColumnCandidates: ["날짜", "기간"],
    matchThreshold: 1,
  },
  {
    key: "reviews",
    expectedName: "리뷰관리",
    expectedHeaderRow: 22,
    headerSearchWindow: [17, 27],
    headerTokens: ["상품번호", "상품명", "구매자평점", "리뷰등록일"],
    dateColumnCandidates: ["리뷰등록일"],
    matchThreshold: 0.7,
  },
  {
    key: "ads",
    expectedName: "광고관리",
    expectedHeaderRow: 17,
    headerSearchWindow: [12, 22],
    headerTokens: [
      "일별",
      "노출수",
      "클릭수",
      "평균 CPC",
      "총비용",
      "구매완료 전환수",
      "구매완료 전환매출액(원)",
      "구매완료 광고수익률(%)",
    ],
    requiredColumns: [
      "일별",
      "노출수",
      "클릭수",
      "평균 CPC",
      "총비용",
      "구매완료 전환수",
      "구매완료 전환매출액(원)",
      "구매완료 광고수익률(%)",
    ],
    dateColumnCandidates: ["일별"],
    matchThreshold: 0.7,
  },
];

export function normalizeHeaderCell(value: unknown): string {
  return String(value ?? "").trim();
}

export function rowMatchesHeaderTokens(
  row: unknown[] | undefined,
  tokens: string[],
  threshold: number
): { matches: boolean; matchedTokens: string[] } {
  if (!row) return { matches: false, matchedTokens: [] };
  const cellSet = new Set(row.map(normalizeHeaderCell));
  const matchedTokens = tokens.filter((t) => cellSet.has(t));
  const required = Math.max(1, Math.ceil(tokens.length * threshold));
  return { matches: matchedTokens.length >= required, matchedTokens };
}
