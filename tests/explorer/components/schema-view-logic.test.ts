import { describe, test, expect } from "bun:test";
import {
  inferType,
  analyzeFields,
} from "../../../src/explorer/components/SchemaView.tsx";
import { Record } from "../../../src/Record.ts";
import type { CachedResult } from "../../../src/explorer/model/types.ts";

function makeCachedResult(
  records: Record[],
  fieldNames?: string[],
): CachedResult {
  const names =
    fieldNames ??
    Array.from(
      new Set(records.flatMap((r) => r.keys())),
    );
  return {
    key: "test",
    stageId: "s1",
    inputId: "in1",
    records,
    spillFile: null,
    recordCount: records.length,
    fieldNames: names,
    computedAt: Date.now(),
    sizeBytes: 100,
    computeTimeMs: 5,
  };
}

// ── inferType ────────────────────────────────────────────────────

describe("inferType", () => {
  test("null returns 'null'", () => {
    expect(inferType(null)).toBe("null");
  });

  test("undefined returns 'null'", () => {
    expect(inferType(undefined)).toBe("null");
  });

  test("string returns 'string'", () => {
    expect(inferType("hello")).toBe("string");
    expect(inferType("")).toBe("string");
  });

  test("number returns 'number'", () => {
    expect(inferType(42)).toBe("number");
    expect(inferType(0)).toBe("number");
    expect(inferType(3.14)).toBe("number");
    expect(inferType(-1)).toBe("number");
  });

  test("boolean returns 'boolean'", () => {
    expect(inferType(true)).toBe("boolean");
    expect(inferType(false)).toBe("boolean");
  });

  test("array returns 'array'", () => {
    expect(inferType([])).toBe("array");
    expect(inferType([1, 2, 3])).toBe("array");
  });

  test("object returns 'object'", () => {
    expect(inferType({})).toBe("object");
    expect(inferType({ a: 1 })).toBe("object");
  });

  test("nested array returns 'array'", () => {
    expect(inferType([[1], [2]])).toBe("array");
  });
});

// ── analyzeFields ────────────────────────────────────────────────

describe("analyzeFields", () => {
  test("returns empty array for empty records", () => {
    const result = makeCachedResult([], []);
    expect(analyzeFields(result)).toEqual([]);
  });

  test("returns empty array when fieldNames is empty", () => {
    const records = [new Record({ x: 1 })];
    const result = makeCachedResult(records, []);
    expect(analyzeFields(result)).toEqual([]);
  });

  test("detects string type", () => {
    const records = [
      new Record({ name: "Alice" }),
      new Record({ name: "Bob" }),
    ];
    const result = makeCachedResult(records, ["name"]);
    const fields = analyzeFields(result);

    expect(fields).toHaveLength(1);
    expect(fields[0]!.name).toBe("name");
    expect(fields[0]!.types).toEqual(["string"]);
  });

  test("detects number type", () => {
    const records = [
      new Record({ age: 30 }),
      new Record({ age: 25 }),
    ];
    const result = makeCachedResult(records, ["age"]);
    const fields = analyzeFields(result);

    expect(fields[0]!.types).toEqual(["number"]);
  });

  test("detects boolean type", () => {
    const records = [
      new Record({ active: true }),
      new Record({ active: false }),
    ];
    const result = makeCachedResult(records, ["active"]);
    const fields = analyzeFields(result);

    expect(fields[0]!.types).toEqual(["boolean"]);
  });

  test("detects mixed types", () => {
    const records = [
      new Record({ val: "hello" }),
      new Record({ val: 42 }),
      new Record({ val: true }),
    ];
    const result = makeCachedResult(records, ["val"]);
    const fields = analyzeFields(result);

    // Types should be sorted
    expect(fields[0]!.types).toEqual(["boolean", "number", "string"]);
  });

  test("detects null type when field is missing from some records", () => {
    const records = [
      new Record({ x: 1, y: "a" }),
      new Record({ x: 2 }),
    ];
    const result = makeCachedResult(records, ["x", "y"]);
    const fields = analyzeFields(result);

    const yField = fields.find((f) => f.name === "y")!;
    expect(yField.types).toContain("null");
  });

  test("calculates % populated correctly — 100%", () => {
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ];
    const result = makeCachedResult(records, ["x"]);
    const fields = analyzeFields(result);

    expect(fields[0]!.populatedPct).toBe(100);
  });

  test("calculates % populated correctly — partial", () => {
    const records = [
      new Record({ x: 1 }),
      new Record({}),
      new Record({ x: 3 }),
      new Record({}),
    ];
    const result = makeCachedResult(records, ["x"]);
    const fields = analyzeFields(result);

    expect(fields[0]!.populatedPct).toBe(50);
  });

  test("calculates % populated correctly — 0%", () => {
    const records = [
      new Record({}),
      new Record({}),
    ];
    const result = makeCachedResult(records, ["x"]);
    const fields = analyzeFields(result);

    expect(fields[0]!.populatedPct).toBe(0);
  });

  test("collects up to 3 sample values", () => {
    const records = [
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "c" }),
      new Record({ x: "d" }),
      new Record({ x: "e" }),
    ];
    const result = makeCachedResult(records, ["x"]);
    const fields = analyzeFields(result);

    expect(fields[0]!.sampleValues.length).toBeLessThanOrEqual(3);
  });

  test("sample values are distinct", () => {
    const records = [
      new Record({ x: "same" }),
      new Record({ x: "same" }),
      new Record({ x: "different" }),
    ];
    const result = makeCachedResult(records, ["x"]);
    const fields = analyzeFields(result);

    const samples = fields[0]!.sampleValues;
    const unique = new Set(samples);
    expect(unique.size).toBe(samples.length);
  });

  test("truncates long sample values to 25 chars", () => {
    const longValue = "a".repeat(50);
    const records = [new Record({ x: longValue })];
    const result = makeCachedResult(records, ["x"]);
    const fields = analyzeFields(result);

    const sample = fields[0]!.sampleValues[0]!;
    expect(sample.length).toBeLessThanOrEqual(25);
    expect(sample).toContain("...");
  });

  test("handles array field values", () => {
    const records = [
      new Record({ tags: ["a", "b"] }),
      new Record({ tags: ["c"] }),
    ];
    const result = makeCachedResult(records, ["tags"]);
    const fields = analyzeFields(result);

    expect(fields[0]!.types).toEqual(["array"]);
    expect(fields[0]!.populatedPct).toBe(100);
  });

  test("handles object field values", () => {
    const records = [
      new Record({ meta: { key: "val" } }),
    ];
    const result = makeCachedResult(records, ["meta"]);
    const fields = analyzeFields(result);

    expect(fields[0]!.types).toEqual(["object"]);
    // Sample should be JSON stringified
    expect(fields[0]!.sampleValues[0]).toContain("key");
  });

  test("handles multiple fields", () => {
    const records = [
      new Record({ name: "Alice", age: 30, active: true }),
      new Record({ name: "Bob", age: 25, active: false }),
    ];
    const result = makeCachedResult(records, ["name", "age", "active"]);
    const fields = analyzeFields(result);

    expect(fields).toHaveLength(3);
    expect(fields.map((f) => f.name)).toEqual(["name", "age", "active"]);
  });

  test("analyzes fields in the order provided by fieldNames", () => {
    const records = [new Record({ z: 1, a: 2, m: 3 })];
    const result = makeCachedResult(records, ["z", "a", "m"]);
    const fields = analyzeFields(result);

    expect(fields.map((f) => f.name)).toEqual(["z", "a", "m"]);
  });
});
