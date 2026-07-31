import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

export interface ExtractedImage {
  dataUrl: string;
  mimeType: string;
  anchorRow: number;
}

export interface OverviewImagesResult {
  images: ExtractedImage[];
  warnings: string[];
}

const REPEATABLE_TAG = /(^|:)(sheet|Relationship|twoCellAnchor|oneCellAnchor)$/;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => REPEATABLE_TAG.test(name),
});

function dirName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function baseName(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

function resolveRelativePath(baseDir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = baseDir.split("/").filter(Boolean);
  for (const part of target.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function mimeTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}

async function readXml(zip: JSZip, path: string): Promise<Record<string, unknown> | null> {
  const file = zip.file(path);
  if (!file) return null;
  const text = await file.async("text");
  return xmlParser.parse(text) as Record<string, unknown>;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Pulls the embedded images out of the 스토어 오버뷰 sheet by walking the OOXML
 * package structure directly (SheetJS's community build does not expose
 * drawings/media), and pairs each anchor's row with the image bytes.
 */
export async function extractOverviewImages(
  arrayBuffer: ArrayBuffer,
  overviewSheetName: string
): Promise<OverviewImagesResult> {
  const warnings: string[] = [];
  const zip = await JSZip.loadAsync(arrayBuffer);

  const workbookXml = await readXml(zip, "xl/workbook.xml");
  if (!workbookXml) {
    return { images: [], warnings: ["xl/workbook.xml을 찾을 수 없어 이미지를 추출하지 못했습니다."] };
  }

  const workbookRoot = workbookXml["workbook"] as Record<string, unknown> | undefined;
  const sheetsNode = (workbookRoot?.["sheets"] ?? {}) as Record<string, unknown>;
  const sheetList = asArray(sheetsNode["sheet"] as Record<string, unknown>[] | Record<string, unknown> | undefined);

  const normalizedTarget = overviewSheetName.normalize("NFC");
  const matchedSheet = sheetList.find(
    (s) => String(s["@_name"] ?? "").normalize("NFC") === normalizedTarget
  );
  if (!matchedSheet) {
    return { images: [], warnings: [`워크북에서 "${overviewSheetName}" 시트를 찾을 수 없습니다.`] };
  }
  const sheetRId = String(matchedSheet["@_r:id"] ?? "");

  const workbookRels = await readXml(zip, "xl/_rels/workbook.xml.rels");
  const workbookRelList = asArray(
    (workbookRels?.["Relationships"] as Record<string, unknown> | undefined)?.["Relationship"] as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | undefined
  );
  const sheetRel = workbookRelList.find((r) => String(r["@_Id"] ?? "") === sheetRId);
  if (!sheetRel) {
    return { images: [], warnings: ["시트에 대한 관계(rels) 정보를 찾을 수 없습니다."] };
  }
  const sheetPath = resolveRelativePath("xl", String(sheetRel["@_Target"] ?? ""));

  const sheetRelsPath = `${dirName(sheetPath)}/_rels/${baseName(sheetPath)}.rels`;
  const sheetRels = await readXml(zip, sheetRelsPath);
  if (!sheetRels) {
    return { images: [], warnings: [] };
  }
  const sheetRelList = asArray(
    (sheetRels["Relationships"] as Record<string, unknown> | undefined)?.["Relationship"] as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | undefined
  );
  const drawingRel = sheetRelList.find((r) => String(r["@_Type"] ?? "").endsWith("/drawing"));
  if (!drawingRel) {
    return { images: [], warnings: [] };
  }
  const drawingPath = resolveRelativePath(dirName(sheetPath), String(drawingRel["@_Target"] ?? ""));

  const drawingXml = await readXml(zip, drawingPath);
  if (!drawingXml) {
    return { images: [], warnings: [`${drawingPath}를 읽지 못했습니다.`] };
  }
  const drawingRelsPath = `${dirName(drawingPath)}/_rels/${baseName(drawingPath)}.rels`;
  const drawingRels = await readXml(zip, drawingRelsPath);
  const drawingRelList = asArray(
    (drawingRels?.["Relationships"] as Record<string, unknown> | undefined)?.["Relationship"] as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | undefined
  );

  const wsDr = (drawingXml["xdr:wsDr"] ?? drawingXml["wsDr"]) as Record<string, unknown> | undefined;
  if (!wsDr) {
    return { images: [], warnings: ["drawing 파일에서 앵커 정보를 찾지 못했습니다."] };
  }
  const anchors = [
    ...asArray(wsDr["xdr:twoCellAnchor"] as Record<string, unknown>[] | Record<string, unknown> | undefined),
    ...asArray(wsDr["xdr:oneCellAnchor"] as Record<string, unknown>[] | Record<string, unknown> | undefined),
  ];

  const images: ExtractedImage[] = [];
  for (const anchor of anchors) {
    const from = anchor["xdr:from"] as Record<string, unknown> | undefined;
    const row = Number(from?.["xdr:row"] ?? 0);
    const pic = anchor["xdr:pic"] as Record<string, unknown> | undefined;
    const blipFill = pic?.["xdr:blipFill"] as Record<string, unknown> | undefined;
    const blip = blipFill?.["a:blip"] as Record<string, unknown> | undefined;
    const embedId = blip?.["@_r:embed"] as string | undefined;
    if (!embedId) continue;

    const mediaRel = drawingRelList.find((r) => String(r["@_Id"] ?? "") === embedId);
    if (!mediaRel) {
      warnings.push(`이미지 관계(${embedId})를 찾을 수 없습니다.`);
      continue;
    }
    const mediaPath = resolveRelativePath(dirName(drawingPath), String(mediaRel["@_Target"] ?? ""));
    const mediaFile = zip.file(mediaPath);
    if (!mediaFile) {
      warnings.push(`이미지 파일(${mediaPath})을 찾을 수 없습니다.`);
      continue;
    }
    const base64 = await mediaFile.async("base64");
    const mimeType = mimeTypeFromPath(mediaPath);
    images.push({ dataUrl: `data:${mimeType};base64,${base64}`, mimeType, anchorRow: row });
  }

  images.sort((a, b) => a.anchorRow - b.anchorRow);
  return { images, warnings };
}
