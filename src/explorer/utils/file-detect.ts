/**
 * Auto-detect file type from extension and return the appropriate
 * fromXXX stage config to insert as the first pipeline stage.
 *
 * Returns null for native formats (JSONL/JSON/NDJSON) or unknown extensions.
 */

import type { StageConfig } from "../model/types.ts";

/** Extensions that are natively supported (JSONL record format). */
const NATIVE_EXTENSIONS = new Set([".jsonl", ".json", ".ndjson"]);

/**
 * Map of file extensions to the fromXXX stage config that should be
 * auto-inserted when that file type is opened.
 */
const EXTENSION_MAP: Record<string, StageConfig> = {
  ".csv": {
    operationName: "fromcsv",
    args: ["--header"],
    enabled: true,
  },
  ".tsv": {
    operationName: "fromcsv",
    args: ["--header", "--delim", "\t"],
    enabled: true,
  },
  ".xml": {
    operationName: "fromxml",
    args: [],
    enabled: true,
  },
};

/**
 * Detect the appropriate fromXXX operation for a given file path.
 *
 * @returns A StageConfig to insert as stage 0, or null if the file
 *          is a native format or the extension is unrecognized.
 */
export function detectInputOperation(filePath: string): StageConfig | null {
  const ext = extname(filePath).toLowerCase();

  if (NATIVE_EXTENSIONS.has(ext)) {
    return null;
  }

  return EXTENSION_MAP[ext] ?? null;
}

/**
 * Check if a file extension is a natively supported record format.
 */
export function isNativeFormat(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return NATIVE_EXTENSIONS.has(ext);
}

/** Extract the file extension including the leading dot. */
function extname(filePath: string): string {
  const basename = filePath.split("/").pop() ?? filePath;
  const dotIndex = basename.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  return basename.slice(dotIndex);
}
