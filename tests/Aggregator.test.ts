import { describe, test, expect } from "bun:test";
import { Record } from "../src/Record.ts";
import {
  aggregatorRegistry,
  makeAggregators,
  mapInitial,
  mapCombine,
  mapSquish,
} from "../src/Aggregator.ts";
import type { Aggregator } from "../src/Aggregator.ts";
import { BaseRegistry } from "../src/BaseRegistry.ts";

// Test aggregator: counts records
class CountAggregator implements Aggregator<number> {
  initial(): number {
    return 0;
  }
  combine(state: number, _record: Record): number {
    return state + 1;
  }
  squish(state: number): number {
    return state;
  }
}

// Test aggregator: sums a field
class SumAggregator implements Aggregator<number> {
  field: string;
  constructor(field: string) { this.field = field; }
  initial(): number {
    return 0;
  }
  combine(state: number, record: Record): number {
    return state + (Number(record.get(this.field)) || 0);
  }
  squish(state: number): number {
    return state;
  }
}

describe("Aggregator", () => {
  describe("interface contract", () => {
    test("count aggregator works correctly", () => {
      const agg = new CountAggregator();
      let state = agg.initial();
      expect(state).toBe(0);

      state = agg.combine(state, new Record({ x: 1 }));
      state = agg.combine(state, new Record({ x: 2 }));
      state = agg.combine(state, new Record({ x: 3 }));

      expect(agg.squish(state)).toBe(3);
    });

    test("sum aggregator works correctly", () => {
      const agg = new SumAggregator("val");
      let state = agg.initial();

      state = agg.combine(state, new Record({ val: 10 }));
      state = agg.combine(state, new Record({ val: 20 }));
      state = agg.combine(state, new Record({ val: 30 }));

      expect(agg.squish(state)).toBe(60);
    });
  });

  describe("map functions", () => {
    test("mapInitial creates initial states for all aggregators", () => {
      const aggrs = new Map<string, Aggregator<unknown>>();
      aggrs.set("count", new CountAggregator());
      aggrs.set("total", new SumAggregator("x"));

      const cookies = mapInitial(aggrs);
      expect(cookies.get("count")).toBe(0);
      expect(cookies.get("total")).toBe(0);
    });

    test("mapCombine folds a record into all aggregators", () => {
      const aggrs = new Map<string, Aggregator<unknown>>();
      aggrs.set("count", new CountAggregator());
      aggrs.set("total", new SumAggregator("x"));

      let cookies = mapInitial(aggrs);
      cookies = mapCombine(aggrs, cookies, new Record({ x: 5 }));
      cookies = mapCombine(aggrs, cookies, new Record({ x: 3 }));

      expect(cookies.get("count")).toBe(2);
      expect(cookies.get("total")).toBe(8);
    });

    test("mapSquish produces final values", () => {
      const aggrs = new Map<string, Aggregator<unknown>>();
      aggrs.set("count", new CountAggregator());
      aggrs.set("total", new SumAggregator("x"));

      let cookies = mapInitial(aggrs);
      cookies = mapCombine(aggrs, cookies, new Record({ x: 10 }));
      cookies = mapCombine(aggrs, cookies, new Record({ x: 20 }));

      const result = mapSquish(aggrs, cookies);
      expect(result.get("count")).toBe(2);
      expect(result.get("total")).toBe(30);
    });
  });

  describe("BaseRegistry", () => {
    test("register and parse", () => {
      const reg = new BaseRegistry<CountAggregator>("test");
      reg.register("count", {
        create: () => new CountAggregator(),
        argCounts: [0],
        shortUsage: "Count records",
        longUsage: "count: Count the number of records",
      });

      const agg = reg.parse("count");
      expect(agg).toBeInstanceOf(CountAggregator);
    });

    test("parse with arguments", () => {
      const reg = new BaseRegistry<SumAggregator>("test");
      reg.register("sum", {
        create: (field: string) => new SumAggregator(field),
        argCounts: [1],
        shortUsage: "Sum a field",
        longUsage: "sum,<field>: Sum the values of a field",
      });

      const agg = reg.parse("sum,val");
      let state = agg.initial();
      state = agg.combine(state, new Record({ val: 42 }));
      expect(agg.squish(state)).toBe(42);
    });

    test("throws on unknown implementation", () => {
      const reg = new BaseRegistry<CountAggregator>("test");
      expect(() => reg.parse("nonexistent")).toThrow("Bad test: nonexistent");
    });

    test("throws on wrong argument count", () => {
      const reg = new BaseRegistry<CountAggregator>("test");
      reg.register("count", {
        create: () => new CountAggregator(),
        argCounts: [0],
        shortUsage: "Count",
        longUsage: "count: Count records",
      });

      expect(() => reg.parse("count,extra")).toThrow("Wrong number");
    });

    test("lists implementations", () => {
      const reg = new BaseRegistry<CountAggregator>("test");
      reg.register("count", {
        create: () => new CountAggregator(),
        argCounts: [0],
        shortUsage: "Count records",
        longUsage: "count: Count",
      });
      reg.register("ct", {
        create: () => new CountAggregator(),
        argCounts: [0],
        shortUsage: "Count records",
        longUsage: "count: Count",
        aliases: ["c"],
      });

      const listing = reg.listImplementations("  ");
      expect(listing).toContain("count");
      expect(listing).toContain("Count records");
    });

    test("aliases work", () => {
      const reg = new BaseRegistry<CountAggregator>("test");
      reg.register("count", {
        create: () => new CountAggregator(),
        argCounts: [0],
        shortUsage: "Count",
        longUsage: "count",
        aliases: ["ct", "c"],
      });

      expect(reg.has("count")).toBe(true);
      expect(reg.has("ct")).toBe(true);
      expect(reg.has("c")).toBe(true);
      expect(reg.has("unknown")).toBe(false);
    });
  });

  describe("aggregatorRegistry", () => {
    test("global registry exists and is usable", () => {
      // Register a test aggregator
      aggregatorRegistry.register("_test_count", {
        create: () => new CountAggregator(),
        argCounts: [0],
        shortUsage: "Test count",
        longUsage: "test count",
      });

      expect(aggregatorRegistry.has("_test_count")).toBe(true);
      const agg = aggregatorRegistry.parse("_test_count");
      expect(agg.initial()).toBe(0);
    });
  });

  describe("makeAggregators", () => {
    test("parses name=spec format", () => {
      aggregatorRegistry.register("_test_sum", {
        create: (field: string) => new SumAggregator(field),
        argCounts: [1],
        shortUsage: "Test sum",
        longUsage: "test sum",
      });

      const aggrs = makeAggregators("total=_test_sum,val");
      expect(aggrs.has("total")).toBe(true);
    });

    test("auto-generates name when not specified", () => {
      const aggrs = makeAggregators("_test_count");
      expect(aggrs.has("_test_count")).toBe(true);
    });
  });
});
