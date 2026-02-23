import { describe, test, expect } from "bun:test";
import {
  detectInputOperation,
  isNativeFormat,
} from "../../../src/explorer/utils/file-detect.ts";

describe("detectInputOperation", () => {
  test("returns fromcsv --header for .csv files", () => {
    const result = detectInputOperation("data.csv");
    expect(result).not.toBeNull();
    expect(result!.operationName).toBe("fromcsv");
    expect(result!.args).toEqual(["--header"]);
    expect(result!.enabled).toBe(true);
  });

  test("returns fromcsv --header --delim for .tsv files", () => {
    const result = detectInputOperation("data.tsv");
    expect(result).not.toBeNull();
    expect(result!.operationName).toBe("fromcsv");
    expect(result!.args).toEqual(["--header", "--delim", "\t"]);
    expect(result!.enabled).toBe(true);
  });

  test("returns fromxml for .xml files", () => {
    const result = detectInputOperation("feed.xml");
    expect(result).not.toBeNull();
    expect(result!.operationName).toBe("fromxml");
    expect(result!.args).toEqual([]);
    expect(result!.enabled).toBe(true);
  });

  test("returns null for .jsonl files", () => {
    expect(detectInputOperation("data.jsonl")).toBeNull();
  });

  test("returns null for .json files", () => {
    expect(detectInputOperation("data.json")).toBeNull();
  });

  test("returns null for .ndjson files", () => {
    expect(detectInputOperation("data.ndjson")).toBeNull();
  });

  test("returns null for unknown extensions", () => {
    expect(detectInputOperation("data.log")).toBeNull();
    expect(detectInputOperation("data.txt")).toBeNull();
    expect(detectInputOperation("data.parquet")).toBeNull();
  });

  test("returns null for files with no extension", () => {
    expect(detectInputOperation("data")).toBeNull();
    expect(detectInputOperation("/tmp/myfile")).toBeNull();
  });

  test("handles full paths correctly", () => {
    const result = detectInputOperation("/home/user/data/report.csv");
    expect(result).not.toBeNull();
    expect(result!.operationName).toBe("fromcsv");
  });

  test("is case-insensitive for extensions", () => {
    expect(detectInputOperation("data.CSV")).not.toBeNull();
    expect(detectInputOperation("data.Csv")).not.toBeNull();
    expect(detectInputOperation("data.TSV")).not.toBeNull();
    expect(detectInputOperation("data.XML")).not.toBeNull();
    expect(detectInputOperation("data.JSONL")).toBeNull();
  });
});

describe("isNativeFormat", () => {
  test("returns true for .jsonl", () => {
    expect(isNativeFormat("data.jsonl")).toBe(true);
  });

  test("returns true for .json", () => {
    expect(isNativeFormat("data.json")).toBe(true);
  });

  test("returns true for .ndjson", () => {
    expect(isNativeFormat("data.ndjson")).toBe(true);
  });

  test("returns false for .csv", () => {
    expect(isNativeFormat("data.csv")).toBe(false);
  });

  test("returns false for unknown extensions", () => {
    expect(isNativeFormat("data.log")).toBe(false);
  });
});
