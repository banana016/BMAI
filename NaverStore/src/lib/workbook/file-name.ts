const FILE_NAME_PATTERN = /^스토어분석양식\((.+)\)\.xlsx$/;

export interface FileNameParseResult {
  storeName: string | null;
  matched: boolean;
}

/**
 * macOS often supplies Hangul filenames in NFD; the pattern and downstream
 * comparisons all assume NFC, so normalize before matching.
 */
export function extractStoreNameFromFileName(fileName: string): FileNameParseResult {
  const normalized = fileName.normalize("NFC");
  const match = normalized.match(FILE_NAME_PATTERN);
  if (!match) {
    return { storeName: null, matched: false };
  }
  const storeName = match[1].trim();
  return { storeName: storeName.length > 0 ? storeName : null, matched: true };
}
