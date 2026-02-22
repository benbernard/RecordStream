import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";

// Import registry to ensure all aggregators are registered
import "../../src/aggregators/registry.ts";
import { aggregatorRegistry } from "../../src/Aggregator.ts";
import type { JsonObject } from "../../src/types/json.ts";

function runAggregator(spec: string, records: Record[]): unknown {
  const agg = aggregatorRegistry.parse(spec);
  let state = agg.initial();
  for (const rec of records) {
    state = agg.combine(state, rec);
  }
  return agg.squish(state);
}

describe("FirstRecord aggregator", () => {
  test("returns first record", () => {
    const records = [
      new Record({ x: 1, y: "a" }),
      new Record({ x: 2, y: "b" }),
      new Record({ x: 3, y: "c" }),
    ];
    const result = runAggregator("firstrec", records) as JsonObject;
    expect(result["x"]).toBe(1);
    expect(result["y"]).toBe("a");
  });

  test("firstrecord alias works", () => {
    expect(aggregatorRegistry.has("firstrecord")).toBe(true);
  });

  test("returns null for no records", () => {
    const result = runAggregator("firstrec", []);
    expect(result).toBeNull();
  });
});

describe("LastRecord aggregator", () => {
  test("returns last record", () => {
    const records = [
      new Record({ x: 1, y: "a" }),
      new Record({ x: 2, y: "b" }),
      new Record({ x: 3, y: "c" }),
    ];
    const result = runAggregator("lastrec", records) as JsonObject;
    expect(result["x"]).toBe(3);
    expect(result["y"]).toBe("c");
  });

  test("lastrecord alias works", () => {
    expect(aggregatorRegistry.has("lastrecord")).toBe(true);
  });
});

describe("RecordForMaximum aggregator", () => {
  test("returns record with maximum field value", () => {
    const records = [
      new Record({ x: 3, name: "three" }),
      new Record({ x: 1, name: "one" }),
      new Record({ x: 5, name: "five" }),
      new Record({ x: 2, name: "two" }),
    ];
    const result = runAggregator("recformax,x", records) as JsonObject;
    expect(result["x"]).toBe(5);
    expect(result["name"]).toBe("five");
  });

  test("aliases work", () => {
    expect(aggregatorRegistry.has("recformaximum")).toBe(true);
    expect(aggregatorRegistry.has("recordformax")).toBe(true);
    expect(aggregatorRegistry.has("recordformaximum")).toBe(true);
  });
});

describe("RecordForMinimum aggregator", () => {
  test("returns record with minimum field value", () => {
    const records = [
      new Record({ x: 3, name: "three" }),
      new Record({ x: 1, name: "one" }),
      new Record({ x: 5, name: "five" }),
      new Record({ x: 2, name: "two" }),
    ];
    const result = runAggregator("recformin,x", records) as JsonObject;
    expect(result["x"]).toBe(1);
    expect(result["name"]).toBe("one");
  });

  test("aliases work", () => {
    expect(aggregatorRegistry.has("recforminimum")).toBe(true);
    expect(aggregatorRegistry.has("recordformin")).toBe(true);
    expect(aggregatorRegistry.has("recordforminimum")).toBe(true);
  });
});
