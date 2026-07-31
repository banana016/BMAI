import { describe, expect, it } from "vitest";
import { extractStoreNameFromFileName } from "@/lib/workbook/file-name";

describe("extractStoreNameFromFileName", () => {
  it("extracts the store name from a well-formed file name", () => {
    const result = extractStoreNameFromFileName("스토어분석양식(클리오네 프라임).xlsx");
    expect(result.matched).toBe(true);
    expect(result.storeName).toBe("클리오네 프라임");
  });

  it("normalizes NFD Hangul (macOS) file names to NFC before matching", () => {
    const nfd = "스토어분석양식(클리오네 프라임).xlsx".normalize("NFD");
    const result = extractStoreNameFromFileName(nfd);
    expect(result.matched).toBe(true);
    expect(result.storeName).toBe("클리오네 프라임");
  });

  it("reports no match for an unrelated file name", () => {
    const result = extractStoreNameFromFileName("random-file.xlsx");
    expect(result.matched).toBe(false);
    expect(result.storeName).toBeNull();
  });

  it("reports no match for the wrong extension", () => {
    const result = extractStoreNameFromFileName("스토어분석양식(클리오네 프라임).xls");
    expect(result.matched).toBe(false);
  });
});
