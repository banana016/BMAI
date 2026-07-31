/**
 * Known alternate header strings per canonical field, keyed by the current
 * template's own header text (index 0 of each list is always that canonical
 * string). This is forward-looking resilience against Naver renaming export
 * columns in a future template revision — none of the non-canonical entries
 * below have been observed in an actual historical export; they're
 * placeholders to extend once a real template drift is seen. Header-row
 * detection and column lookup both resolve through this map so a future
 * rename degrades to a "matched via alias" warning instead of a hard failure.
 */
export const HEADER_ALIASES: Record<string, string[]> = {
  날짜: ["날짜"],
  채널: ["채널"],
  상품결제건수: ["상품결제건수", "결제건수"],
  "판매금액(총)": ["판매금액(총)", "총판매금액"],
  "판매금액(순)": ["판매금액(순)", "순판매금액"],
  상품결제단가: ["상품결제단가", "결제단가"],
  방문수: ["방문수", "방문자수"],
  구매전환율: ["구매전환율", "전환율"],
  "경로(1단계)": ["경로(1단계)", "유입경로(1단계)"],
  "경로(2단계)": ["경로(2단계)", "유입경로(2단계)"],
  "경로(3단계)": ["경로(3단계)", "유입경로(3단계)"],
  검색어: ["검색어", "키워드"],
  고객분류: ["고객분류", "고객구분"],
  상품번호: ["상품번호", "상품코드"],
  상품명: ["상품명"],
  구매자평점: ["구매자평점", "평점"],
  리뷰등록일: ["리뷰등록일", "작성일"],
  일별: ["일별"],
  노출수: ["노출수"],
  클릭수: ["클릭수"],
  "평균 CPC": ["평균 CPC", "평균CPC"],
  총비용: ["총비용", "광고비"],
  "구매완료 전환수": ["구매완료 전환수"],
  "구매완료 전환매출액(원)": ["구매완료 전환매출액(원)", "구매완료 전환매출액"],
  "구매완료 광고수익률(%)": ["구매완료 광고수익률(%)", "구매완료 ROAS(%)"],
};

/** Every acceptable header string for a canonical field — always includes the canonical string itself, even if not otherwise listed. */
export function resolveAliases(canonical: string): string[] {
  const known = HEADER_ALIASES[canonical];
  if (!known) return [canonical];
  return known.includes(canonical) ? known : [canonical, ...known];
}
