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
  forFieldAgg,
  forField2Agg,
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

  describe("forFieldAgg", () => {
    test("aggregates per matching field with regex", () => {
      const agg = forFieldAgg(/^t/, (f) => aggregatorRegistry.parse(`sum,${f}`));
      const records = [
        new Record({ t_a: 1, t_b: 10, other: 100 }),
        new Record({ t_a: 2, t_b: 20, other: 200 }),
        new Record({ t_a: 3, t_b: 30, other: 300 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toEqual({ t_a: 6, t_b: 60 });
    });

    test("aggregates per matching field with string pattern", () => {
      const agg = forFieldAgg("^score", (f) => aggregatorRegistry.parse(`average,${f}`));
      const records = [
        new Record({ score_math: 80, score_english: 90, name: "alice" }),
        new Record({ score_math: 100, score_english: 70, name: "bob" }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toEqual({ score_math: 90, score_english: 80 });
    });

    test("returns empty map when no fields match", () => {
      const agg = forFieldAgg(/^zzz/, (f) => aggregatorRegistry.parse(`sum,${f}`));
      const records = [new Record({ a: 1, b: 2 })];
      const result = runAggregator(agg, records);
      expect(result).toEqual({});
    });

    test("handles fields appearing in later records", () => {
      const agg = forFieldAgg(/^x/, (f) => aggregatorRegistry.parse(`sum,${f}`));
      const records = [
        new Record({ x_a: 1 }),
        new Record({ x_a: 2, x_b: 10 }),
        new Record({ x_a: 3, x_b: 20 }),
      ];
      const result = runAggregator(agg, records);
      // x_a seen in all 3 records, x_b only in last 2
      expect(result).toEqual({ x_a: 6, x_b: 30 });
    });

    test("works with count aggregator (no field arg)", () => {
      const agg = forFieldAgg(/^t/, (_f) => aggregatorRegistry.parse("count"));
      const records = [
        new Record({ t_a: 1, t_b: 10 }),
        new Record({ t_a: 2, t_b: 20 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toEqual({ t_a: 2, t_b: 2 });
    });
  });

  describe("forField2Agg", () => {
    test("aggregates per pair of matching fields", () => {
      const agg = forField2Agg(/^x/, /^y/, (f1, _f2) =>
        aggregatorRegistry.parse(`sum,${f1}`)
      );
      const records = [
        new Record({ x1: 1, x2: 10, y1: 100, y2: 200 }),
        new Record({ x1: 2, x2: 20, y1: 300, y2: 400 }),
      ];
      const result = runAggregator(agg, records);
      // Pairs: x1,y1 x1,y2 x2,y1 x2,y2 — all summing their first field
      expect(result).toEqual({
        "x1,y1": 3,
        "x1,y2": 3,
        "x2,y1": 30,
        "x2,y2": 30,
      });
    });

    test("returns empty map when no pairs match", () => {
      const agg = forField2Agg(/^aaa/, /^bbb/, (_f1, _f2) =>
        aggregatorRegistry.parse("count")
      );
      const records = [new Record({ x: 1, y: 2 })];
      const result = runAggregator(agg, records);
      expect(result).toEqual({});
    });

    test("handles count aggregator for field pairs", () => {
      const agg = forField2Agg(/^x/, /^y/, (_f1, _f2) =>
        aggregatorRegistry.parse("count")
      );
      const records = [
        new Record({ x1: 1, y1: 10 }),
        new Record({ x1: 2, y1: 20 }),
        new Record({ x1: 3, y1: 30 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toEqual({ "x1,y1": 3 });
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

    test("parses for_field with regex", () => {
      const agg = parseDomainLanguage('for_field(/^t/, ($f) => sum($f))');
      const records = [
        new Record({ t_a: 1, t_b: 10, other: 100 }),
        new Record({ t_a: 2, t_b: 20, other: 200 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toEqual({ t_a: 3, t_b: 30 });
    });

    test("parses for_field with string pattern", () => {
      const agg = parseDomainLanguage('for_field("^score", ($f) => average($f))');
      const records = [
        new Record({ score_math: 80, score_english: 90, name: "a" }),
        new Record({ score_math: 100, score_english: 70, name: "b" }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toEqual({ score_math: 90, score_english: 80 });
    });

    test("parses for_field with two regexes", () => {
      const agg = parseDomainLanguage('for_field(/^x/, /^y/, ($f1, $f2) => count())');
      const records = [
        new Record({ x1: 1, y1: 10 }),
        new Record({ x1: 2, y1: 20 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toEqual({ "x1,y1": 2 });
    });

    test("parses subset_agg with count", () => {
      const agg = parseDomainLanguage('subset_agg("{{x}} > 2", count())');
      const records = [
        new Record({ x: 1 }),
        new Record({ x: 3 }),
        new Record({ x: 5 }),
        new Record({ x: 2 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toBe(2);
    });

    test("parses subset_agg with sum", () => {
      const agg = parseDomainLanguage(`subset_agg("{{status}} === 'active'", sum("value"))`);
      const records = [
        new Record({ status: "active", value: 10 }),
        new Record({ status: "inactive", value: 20 }),
        new Record({ status: "active", value: 30 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toBe(40);
    });

    test("parses subset_aggregator alias", () => {
      const agg = parseDomainLanguage('subset_aggregator("{{x}} >= 5", count())');
      const records = [
        new Record({ x: 3 }),
        new Record({ x: 5 }),
        new Record({ x: 7 }),
      ];
      const result = runAggregator(agg, records);
      expect(result).toBe(2);
    });
  });
});
