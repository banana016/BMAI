import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { diagnoseWorkbook } from "@/lib/workbook/parser";

// Points at a real "스토어분석양식(...).xlsx" file on the developer's machine for a
// smoke test against real data. Never commit an actual value for this variable,
// and never hardcode a desktop path here directly.
const fixturePath = process.env.NAVERSTORE_FIXTURE_XLSX_PATH;
const hasFixture = !!fixturePath && existsSync(fixturePath);

describe.skipIf(!hasFixture)("diagnoseWorkbook against a real fixture file", () => {
  it("finds all 7 sheets and core store metadata", async () => {
    const buffer = readFileSync(fixturePath as string);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const fileName = path.basename(fixturePath as string);

    const result = await diagnoseWorkbook(arrayBuffer, fileName);

    expect(result.overallStatus).not.toBe("error");
    expect(result.sheets).toHaveLength(6);
    for (const sheet of result.sheets) {
      expect(sheet.found).toBe(true);
    }
    expect(result.storeName).not.toBeNull();
    expect(result.overview?.storeUrl).not.toBeNull();
    expect(result.overview?.heroImage).not.toBeNull();
  });
});
