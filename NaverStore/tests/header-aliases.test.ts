import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { diagnoseWorkbook } from "@/lib/workbook/parser";
import { normalizeSalesRows } from "@/lib/normalize/sales";
import { resolveAliases } from "@/lib/workbook/header-aliases";

const FILE_NAME = "스토어분석양식(별칭 테스트).xlsx";

function fillerRows(count: number): unknown[][] {
  return Array.from({ length: count }, () => []);
}

/** Same shape as the Phase 1 synthetic fixture, but 구매전환율 renamed to its known alias 전환율. */
function buildAliasedWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const overviewWs = XLSX.utils.aoa_to_sheet([
    [],
    [null, null, null, null, null, null, null, null, null, "스토어 url", "https://example.com/alias-test"],
  ]);
  overviewWs["K2"] = {
    t: "s",
    v: "https://example.com/alias-test",
    l: { Target: "https://example.com/alias-test" },
  };
  XLSX.utils.book_append_sheet(wb, overviewWs, "스토어 오버뷰");

  // "전환율" instead of "구매전환율" — a plausible future template rename.
  const salesHeader = ["날짜", "채널", "상품결제건수", "판매금액(총)", "판매금액(순)", "상품결제단가", "방문수", "전환율"];
  const salesRows = [
    [new Date(Date.UTC(2026, 3, 1)), "전체", 10, 100000, 95000, 10000, 200, 5],
    [new Date(Date.UTC(2026, 3, 2)), "전체", 12, 120000, 114000, 10000, 220, 5.5],
  ];
  const salesWs = XLSX.utils.aoa_to_sheet([...fillerRows(19), salesHeader, ...salesRows]);
  XLSX.utils.book_append_sheet(wb, salesWs, "판매분석");

  const trafficHeader = ["날짜", "경로(1단계)", "경로(2단계)", "경로(3단계)", "방문수", "상품결제건수", "구매전환율", "판매금액(총)"];
  const trafficWs = XLSX.utils.aoa_to_sheet([
    ...fillerRows(20),
    trafficHeader,
    [new Date(Date.UTC(2026, 3, 1)), "전체", "전체", "전체", 200, 10, 5, 100000],
  ]);
  XLSX.utils.book_append_sheet(wb, trafficWs, "방문분석");

  const searchHeader = ["날짜", "검색어", "방문수", "상품결제건수", "구매전환율", "판매금액(총)", "상품결제단가"];
  const searchWs = XLSX.utils.aoa_to_sheet([
    ...fillerRows(16),
    searchHeader,
    [new Date(Date.UTC(2026, 2, 1)), "전체", 50, 3, 6, 30000, 10000],
  ]);
  XLSX.utils.book_append_sheet(wb, searchWs, "검색분석");

  const customersHeader = ["날짜", "고객분류", "방문고객수", "방문고객수비중", "결제고객수", "결제고객수비중", "구매전환율(고객)", "판매금액(총)", "판매금액(총)비중", "객단가"];
  const customersWs = XLSX.utils.aoa_to_sheet([
    ...fillerRows(14),
    customersHeader,
    ["2026-04-27~2026-05-03", "전체합산", 100, "-", 10, "-", 10, 100000, "-", 10000],
  ]);
  XLSX.utils.book_append_sheet(wb, customersWs, "고객분석");

  const reviewsHeader = ["상품번호", "상품명", "구매자평점", "리뷰등록일"];
  const reviewsWs = XLSX.utils.aoa_to_sheet([
    ...fillerRows(21),
    reviewsHeader,
    [1001, "테스트 상품", 5, new Date(Date.UTC(2026, 0, 30))],
  ]);
  XLSX.utils.book_append_sheet(wb, reviewsWs, "리뷰관리");

  const adsHeader = [
    "일별",
    "노출수",
    "클릭수",
    "평균 CPC",
    "총비용",
    "구매완료 전환수",
    "구매완료 전환매출액(원)",
    "구매완료 광고수익률(%)",
  ];
  const adsWs = XLSX.utils.aoa_to_sheet([
    ...fillerRows(16),
    adsHeader,
    [new Date(Date.UTC(2026, 4, 1)), 1000, 50, 500, 25000, 2, 60000, 240],
  ]);
  XLSX.utils.book_append_sheet(wb, adsWs, "광고관리");

  return wb;
}

function toArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as unknown as ArrayBuffer;
}

describe("header aliases", () => {
  it("resolveAliases always includes the canonical name itself", () => {
    expect(resolveAliases("구매전환율")).toContain("구매전환율");
    expect(resolveAliases("완전히_새로운_필드")).toEqual(["완전히_새로운_필드"]);
  });

  it("diagnoseWorkbook accepts a renamed column via its known alias, with a template-drift warning instead of a hard error", async () => {
    const wb = buildAliasedWorkbook();
    const result = await diagnoseWorkbook(toArrayBuffer(wb), FILE_NAME);

    expect(result.overallStatus).not.toBe("error");
    const sales = result.sheets.find((s) => s.key === "sales")!;
    expect(sales.missingRequiredColumns).toEqual([]);
    expect(result.warnings.some((w) => w.includes("전환율") && w.includes("별칭"))).toBe(true);
  });

  it("normalizeSalesRows still reads the conversion rate through the alias", () => {
    const wb = buildAliasedWorkbook();
    const { rows } = normalizeSalesRows(wb);
    expect(rows).toHaveLength(2);
    expect(rows[0].conversionRate).toBeCloseTo(0.05);
  });
});
