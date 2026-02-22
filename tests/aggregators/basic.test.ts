import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";

// Import registry to ensure all aggregators are registered
import "../../src/aggregators/registry.ts";
import { aggregatorRegistry } from "../../src/Aggregator.ts";

function runAggregator(spec: string, records: Record[]): unknown {
  const agg = aggregatorRegistry.parse(spec);
  let state = agg.initial();
  for (const rec of records) {
    state = agg.combine(state, rec);
  }
  return agg.squish(state);
}

describe("Sum aggregator", () => {
  test("sums numeric field values", () => {
    const result = runAggregator("sum,x", [
      new Record({ x: 1, y: 2 }),
      new Record({ x: 3, y: 4 }),
    ]);
    expect(result).toBe(4);
  });

  test("sums string numeric values", () => {
    const result = runAggregator("sum,x", [
      new Record({ x: "10" }),
      new Record({ x: "20" }),
    ]);
    expect(result).toBe(30);
  });

  test("returns null for no records", () => {
    const result = runAggregator("sum,x", []);
    expect(result).toBeNull();
  });
});

describe("Count aggregator", () => {
  test("counts records", () => {
    const result = runAggregator("count", [
      new Record({}),
      new Record({}),
      new Record({}),
    ]);
    expect(result).toBe(3);
  });

  test("ct alias works", () => {
    const result = runAggregator("ct", [
      new Record({}),
      new Record({}),
    ]);
    expect(result).toBe(2);
  });

  test("returns null for no records", () => {
    const result = runAggregator("count", []);
    expect(result).toBeNull();
  });
});

describe("Average aggregator", () => {
  test("averages field values", () => {
    const result = runAggregator("avg,x", [
      new Record({ x: 1 }),
      new Record({ x: 3 }),
      new Record({ x: 7 }),
    ]);
    expect(result).toBeCloseTo(11 / 3);
  });

  test("average alias works", () => {
    expect(aggregatorRegistry.has("average")).toBe(true);
  });
});

describe("Maximum aggregator", () => {
  test("finds maximum value", () => {
    const result = runAggregator("max,x", [
      new Record({ x: 3 }),
      new Record({ x: 1 }),
      new Record({ x: 5 }),
      new Record({ x: 2 }),
    ]);
    expect(result).toBe(5);
  });

  test("maximum alias works", () => {
    expect(aggregatorRegistry.has("maximum")).toBe(true);
  });
});

describe("Minimum aggregator", () => {
  test("finds minimum value", () => {
    const result = runAggregator("min,x", [
      new Record({ x: 3 }),
      new Record({ x: 1 }),
      new Record({ x: 5 }),
      new Record({ x: 2 }),
    ]);
    expect(result).toBe(1);
  });

  test("minimum alias works", () => {
    expect(aggregatorRegistry.has("minimum")).toBe(true);
  });
});

describe("First aggregator", () => {
  test("returns first value", () => {
    const result = runAggregator("first,x", [
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "c" }),
    ]);
    expect(result).toBe("a");
  });
});

describe("Last aggregator", () => {
  test("returns last value", () => {
    const result = runAggregator("last,x", [
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "c" }),
    ]);
    expect(result).toBe("c");
  });
});
