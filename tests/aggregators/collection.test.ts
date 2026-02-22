import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";

// Import registry to ensure all aggregators are registered
import "../../src/aggregators/registry.ts";
import { aggregatorRegistry } from "../../src/Aggregator.ts";
import type { JsonObject, JsonArray } from "../../src/types/json.ts";

function runAggregator(spec: string, records: Record[]): unknown {
  const agg = aggregatorRegistry.parse(spec);
  let state = agg.initial();
  for (const rec of records) {
    state = agg.combine(state, rec);
  }
  return agg.squish(state);
}

describe("Records aggregator", () => {
  test("collects all records", () => {
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ];
    const result = runAggregator("records", records) as JsonArray;
    expect(result).toHaveLength(2);
    expect((result[0] as JsonObject)["x"]).toBe(1);
    expect((result[1] as JsonObject)["x"]).toBe(2);
  });

  test("recs alias works", () => {
    expect(aggregatorRegistry.has("recs")).toBe(true);
  });
});

describe("Array aggregator", () => {
  test("collects field values into an array", () => {
    const records = [
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "c" }),
    ];
    const result = runAggregator("array,x", records);
    expect(result).toEqual(["a", "b", "c"]);
  });
});

describe("Concatenate aggregator", () => {
  test("concatenates field values with delimiter", () => {
    const records = [
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "c" }),
    ];
    const result = runAggregator("concat,;,x", records);
    expect(result).toBe("a;b;c");
  });

  test("concatenate alias works", () => {
    expect(aggregatorRegistry.has("concatenate")).toBe(true);
  });
});

describe("UniqArray aggregator", () => {
  test("collects unique values into sorted array", () => {
    const records = [
      new Record({ x: "b" }),
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "c" }),
      new Record({ x: "a" }),
    ];
    const result = runAggregator("uarray,x", records);
    expect(result).toEqual(["a", "b", "c"]);
  });
});

describe("UniqConcatenate aggregator", () => {
  test("concatenates unique values with delimiter", () => {
    const records = [
      new Record({ x: "b" }),
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "c" }),
    ];
    const result = runAggregator("uconcat,;,x", records);
    expect(result).toBe("a;b;c");
  });

  test("uconcatenate alias works", () => {
    expect(aggregatorRegistry.has("uconcatenate")).toBe(true);
  });
});

describe("CountBy aggregator", () => {
  test("counts by unique values", () => {
    const records = [
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "a" }),
      new Record({ x: "c" }),
      new Record({ x: "a" }),
    ];
    const result = runAggregator("cb,x", records) as JsonObject;
    expect(result["a"]).toBe(3);
    expect(result["b"]).toBe(1);
    expect(result["c"]).toBe(1);
  });

  test("countby alias works", () => {
    expect(aggregatorRegistry.has("countby")).toBe(true);
  });
});

describe("DistinctCount aggregator", () => {
  test("counts distinct values", () => {
    const records = [
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "a" }),
      new Record({ x: "c" }),
    ];
    const result = runAggregator("dct,x", records);
    expect(result).toBe(3);
  });

  test("aliases work", () => {
    expect(aggregatorRegistry.has("dcount")).toBe(true);
    expect(aggregatorRegistry.has("distinctcount")).toBe(true);
    expect(aggregatorRegistry.has("distinctct")).toBe(true);
  });
});

describe("ValuesToKeys aggregator", () => {
  test("maps key field values to value field values", () => {
    const records = [
      new Record({ k: "FOO", t: 2 }),
      new Record({ k: "BAR", t: 5 }),
    ];
    const result = runAggregator("vk,k,t", records) as JsonObject;
    expect(result["FOO"]).toBe(2);
    expect(result["BAR"]).toBe(5);
  });

  test("later values clobber earlier ones", () => {
    const records = [
      new Record({ k: "FOO", t: 1 }),
      new Record({ k: "FOO", t: 2 }),
    ];
    const result = runAggregator("vk,k,t", records) as JsonObject;
    expect(result["FOO"]).toBe(2);
  });

  test("valuestokeys alias works", () => {
    expect(aggregatorRegistry.has("valuestokeys")).toBe(true);
  });
});
