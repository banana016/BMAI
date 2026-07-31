import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { diagnoseWorkbook } from "@/lib/workbook/parser";

const FILE_NAME = "스토어분석양식(테스트 스토어).xlsx";

function fillerRows(count: number): unknown[][] {
  return Array.from({ length: count }, () => []);
}

function buildValidWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const overviewAoa: unknown[][] = [
    [],
    [null, null, null, null, null, null, null, null, null, "스토어 url", "https://brand.naver.com/testbrand"],
  ];
  const overviewWs = XLSX.utils.aoa_to_sheet(overviewAoa);
  overviewWs["K2"] = { t: "s", v: "https://brand.naver.com/testbrand", l: { Target: "https://brand.naver.com/testbrand" } };
  XLSX.utils.book_append_sheet(wb, overviewWs, "스토어 오버뷰");

  const salesHeader = ["날짜", "채널", "상품결제건수", "판매금액(총)", "판매금액(순)", "상품결제단가", "방문수", "구매전환율"];
  const salesRows = [
    [new Date(Date.UTC(2026, 3, 1)), "전체", 10, 100000, 95000, 10000, 200, 0.05],
    [new Date(Date.UTC(2026, 3, 2)), "전체", 12, 120000, 114000, 10000, 220, 0.0545],
  ];
  const salesWs = XLSX.utils.aoa_to_sheet([...fillerRows(19), salesHeader, ...salesRows]);
  XLSX.utils.book_append_sheet(wb, salesWs, "판매분석");

  const trafficHeader = ["날짜", "경로(1단계)", "경로(2단계)", "경로(3단계)", "방문수", "상품결제건수", "구매전환율", "판매금액(총)"];
  const trafficRows = [
    [new Date(Date.UTC(2026, 3, 3)), "전체", "전체", "전체", 200, 10, 0.05, 100000],
    [new Date(Date.UTC(2026, 3, 3)), "네이버 검색", "전체", "전체", 120, 6, 0.05, 60000],
  ];
  const trafficWs = XLSX.utils.aoa_to_sheet([...fillerRows(20), trafficHeader, ...trafficRows]);
  XLSX.utils.book_append_sheet(wb, trafficWs, "방문분석");

  const searchHeader = ["날짜", "검색어", "방문수", "상품결제건수", "구매전환율", "판매금액(총)", "상품결제단가"];
  const searchRows = [[new Date(Date.UTC(2026, 2, 1)), "전체", 50, 3, 0.06, 30000, 10000]];
  const searchWs = XLSX.utils.aoa_to_sheet([...fillerRows(16), searchHeader, ...searchRows]);
  XLSX.utils.book_append_sheet(wb, searchWs, "검색분석");

  const customersHeader = ["날짜", "고객분류", "방문고객수", "판매금액(총)비중"];
  const customersRows = [["2026-04-27~2026-05-03", "전체합산", 100, 1]];
  const customersWs = XLSX.utils.aoa_to_sheet([...fillerRows(14), customersHeader, ...customersRows]);
  XLSX.utils.book_append_sheet(wb, customersWs, "고객분석");

  const reviewsHeader = ["상품번호", "상품명", "구매자평점", "리뷰등록일"];
  const reviewsRows = [[1001, "테스트 상품", 5, new Date(Date.UTC(2026, 0, 30))]];
  const reviewsWs = XLSX.utils.aoa_to_sheet([...fillerRows(21), reviewsHeader, ...reviewsRows]);
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
  const adsRows = [[new Date(Date.UTC(2026, 4, 1)), 1000, 50, 500, 25000, 2, 60000, 240]];
  const adsWs = XLSX.utils.aoa_to_sheet([...fillerRows(16), adsHeader, ...adsRows]);
  XLSX.utils.book_append_sheet(wb, adsWs, "광고관리");

  return wb;
}

function toArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as unknown;
  return out as ArrayBuffer;
}

describe("diagnoseWorkbook", () => {
  it("passes a well-formed workbook with no missing required columns", async () => {
    const wb = buildValidWorkbook();
    const result = await diagnoseWorkbook(toArrayBuffer(wb), FILE_NAME);

    expect(result.storeName).toBe("테스트 스토어");
    expect(result.overview?.storeUrl).toBe("https://brand.naver.com/testbrand");
    expect(result.overview?.storeUrlSource).toBe("hyperlink");
    expect(result.sheets).toHaveLength(6);
    expect(result.errors).toEqual([]);

    const sales = result.sheets.find((s) => s.key === "sales");
    expect(sales?.found).toBe(true);
    expect(sales?.headerRow).toBe(20);
    expect(sales?.headerRowIsFallback).toBe(false);
    expect(sales?.dataRowCount).toBe(2);
    expect(sales?.missingRequiredColumns).toEqual([]);
    expect(sales?.dateRange).toEqual({ min: "2026-04-01", max: "2026-04-02" });

    const ads = result.sheets.find((s) => s.key === "ads");
    expect(ads?.missingRequiredColumns).toEqual([]);

    const customers = result.sheets.find((s) => s.key === "customers");
    expect(customers?.dateRange).toEqual({ min: "2026-04-27", max: "2026-05-03" });

    expect(result.overallStatus).not.toBe("error");
  });

  it("reports an error when a required sheet is missing", async () => {
    const wb = buildValidWorkbook();
    delete wb.Sheets["리뷰관리"];
    wb.SheetNames = wb.SheetNames.filter((n) => n !== "리뷰관리");

    const result = await diagnoseWorkbook(toArrayBuffer(wb), FILE_NAME);

    expect(result.overallStatus).toBe("error");
    expect(result.errors.some((e) => e.includes("리뷰관리"))).toBe(true);
    const reviews = result.sheets.find((s) => s.key === "reviews");
    expect(reviews?.found).toBe(false);
  });

  it("reports missing required columns when a header is renamed", async () => {
    const wb = buildValidWorkbook();
    const salesWs = wb.Sheets["판매분석"];
    // Row 20 (1-indexed) holds the header; rename 구매전환율 -> 전환율(변경됨).
    salesWs["H20"] = { t: "s", v: "전환율(변경됨)" };
    const range = XLSX.utils.decode_range(salesWs["!ref"] as string);
    salesWs["!ref"] = XLSX.utils.encode_range(range);

    const result = await diagnoseWorkbook(toArrayBuffer(wb), FILE_NAME);

    const sales = result.sheets.find((s) => s.key === "sales");
    expect(sales?.missingRequiredColumns).toContain("구매전환율");
    expect(result.overallStatus).toBe("error");
    expect(result.errors.some((e) => e.includes("필수 열 누락"))).toBe(true);
  });

  it("fails gracefully on an empty/corrupt file", async () => {
    const result = await diagnoseWorkbook(new ArrayBuffer(0), FILE_NAME);
    expect(result.overallStatus).toBe("error");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects a file with the wrong extension", async () => {
    const wb = buildValidWorkbook();
    const result = await diagnoseWorkbook(toArrayBuffer(wb), "스토어분석양식(테스트 스토어).xls");
    expect(result.overallStatus).toBe("error");
    expect(result.errors[0]).toContain(".xlsx");
    expect(result.sheets).toEqual([]);
  });
});
