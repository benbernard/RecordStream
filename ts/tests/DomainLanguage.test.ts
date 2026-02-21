import { describe, test, expect } from "bun:test";
import { Record } from "../src/Record.ts";

// Import all aggregators so they are registered
import "../src/aggregators/registry.ts";
import { aggregatorRegistry } from "../src/Aggregator.ts";

import {
  parseDomainLanguage,
  compileSnippet,
  snippetValuation,
  KeySpecValuation,
  RecordValuation,
  injectIntoAgg,
  mapReduceAgg,
  subsetAgg,
  xformAgg,
} from "../src/DomainLanguage.ts";

function runAggregator(agg: { initial(): unknown; combine(s: unknown, r: Record): unknown; squish(s: unknown): unknown }, records: Record[]): unknown {
  let state = agg.initial();
  for (const rec of records) {
    state = agg.combine(state, rec);
  }
  return agg.squish(state);
}

describe("DomainLanguage", () => {
  describe("Valuations", () => {
    test("KeySpecValuation extracts field value", () => {
      const val = new KeySpecValuation("x");
      expect(val.evaluateRecord(new Record({ x: 42 }))).toBe(42);
    });

    test("KeySpecValuation returns null for missing field", () => {
      const val = new KeySpecValuation("missing");
      expect(val.evaluateRecord(new Record({ x: 42 }))).toBeNull();
    });

    test("RecordValuation returns entire record", () => {
      const val = new RecordValuation();
      const result = val.evaluateRecord(new Record({ x: 1, y: 2 }));
      expect(result).toEqual({ x: 1, y: 2 });
    });
  });

  describe("compileSnippet", () => {
    test("replaces {{field}} with field access", () => {
      const fn = compileSnippet("{{x}} + {{y}}");
      const result = fn(new Record({ x: 3, y: 4 }));
      expect(result).toBe(7);
    });

    test("handles nested field access", () => {
      const fn = compileSnippet("{{a/b}}");
      const result = fn(new Record({ a: { b: 42 } }));
      expect(result).toBe(42);
    });
  });

  describe("snippetValuation", () => {
    test("creates valuation from snippet", () => {
      const val = snippetValuation("{{x}} * 2");
      expect(val.evaluateRecord(new Record({ x: 5 }))).toBe(10);
    });
  });

  describe("injectIntoAgg", () => {
    test("creates inject-into aggregator", () => {
      const agg = injectIntoAgg("0", "$a + {{x}}", "$a * 2");
      const records = [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
      ];
      const result = runAggregator(agg, records);
      // initial=0, combine: 0+1=1, 1+2=3, 3+3=6, squish: 6*2=12
      expect(result).toBe(12);
    });

    test("inject-into without squish", () => {
      const agg = injectIntoAgg("0", "$a + {{x}}");
      const records = [
        new Record({ x: 10 }),
        new Record({ x: 20 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toBe(30);
    });
  });

  describe("mapReduceAgg", () => {
    test("creates map-reduce aggregator", () => {
      const agg = mapReduceAgg("{{x}}", "$a + $b");
      const records = [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toBe(6);
    });

    test("map-reduce with squish", () => {
      const agg = mapReduceAgg("[1, {{x}}]", "[$a[0] + $b[0], $a[1] + $b[1]]", "$a[1] / $a[0]");
      const records = [
        new Record({ x: 2 }),
        new Record({ x: 4 }),
        new Record({ x: 6 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toBe(4); // average = 12/3
    });
  });

  describe("subsetAgg", () => {
    test("filters records before aggregating", () => {
      const countAgg = aggregatorRegistry.parse("count");
      const agg = subsetAgg("{{x}} > 2", countAgg);
      const records = [
        new Record({ x: 1 }),
        new Record({ x: 3 }),
        new Record({ x: 5 }),
        new Record({ x: 2 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toBe(2); // x=3 and x=5
    });
  });

  describe("xformAgg", () => {
    test("transforms aggregator result", () => {
      const sumAgg = aggregatorRegistry.parse("sum,x");
      const agg = xformAgg(sumAgg, "$a * 10");
      const records = [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toBe(60); // sum=6, *10=60
    });
  });

  describe("parseDomainLanguage", () => {
    test("parses simple aggregator expression", () => {
      const agg = parseDomainLanguage('sum("x")');
      const records = [
        new Record({ x: 10 }),
        new Record({ x: 20 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toBe(30);
    });

    test("parses count expression", () => {
      const agg = parseDomainLanguage("count()");
      const records = [new Record({}), new Record({}), new Record({})];
      const result = runAggregator(agg, records);
      expect(result).toBe(3);
    });

    test("parses ct alias", () => {
      const agg = parseDomainLanguage("ct()");
      const records = [new Record({})];
      const result = runAggregator(agg, records);
      expect(result).toBe(1);
    });
  });
});
