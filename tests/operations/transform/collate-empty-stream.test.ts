import { describe, test, expect } from "bun:test";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { CollateOperation } from "../../../src/operations/transform/collate.ts";

// Import aggregators to ensure they're registered
import "../../../src/aggregators/Average.ts";
import "../../../src/aggregators/Sum.ts";
import "../../../src/aggregators/Count.ts";
import "../../../src/aggregators/Maximum.ts";
import "../../../src/aggregators/Minimum.ts";

function makeOp(args: string[]): { op: CollateOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new CollateOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("CollateOperation - empty stream (issue #65)", () => {
  test("avg on empty stream does not crash", () => {
    const { op, collector } = makeOp(["--aggregator", "avg,value"]);
    // Feed no records at all - should not throw
    op.finish();

    // With no keys and no input, collate produces nothing (correct per issue discussion)
    expect(collector.records.length).toBe(0);
  });

  test("count on empty stream does not crash", () => {
    const { op, collector } = makeOp(["--aggregator", "count"]);
    op.finish();
    expect(collector.records.length).toBe(0);
  });

  test("sum on empty stream does not crash", () => {
    const { op, collector } = makeOp(["--aggregator", "sum,x"]);
    op.finish();
    expect(collector.records.length).toBe(0);
  });

  test("max on empty stream does not crash", () => {
    const { op, collector } = makeOp(["--aggregator", "max,x"]);
    op.finish();
    expect(collector.records.length).toBe(0);
  });

  test("min on empty stream does not crash", () => {
    const { op, collector } = makeOp(["--aggregator", "min,x"]);
    op.finish();
    expect(collector.records.length).toBe(0);
  });

  test("avg on empty stream with key produces no records", () => {
    const { op, collector } = makeOp(["--key", "group", "--aggregator", "avg,value"]);
    op.finish();
    expect(collector.records.length).toBe(0);
  });

  test("multiple aggregators on empty stream does not crash", () => {
    const { op, collector } = makeOp([
      "--aggregator", "avg,value",
      "--aggregator", "count",
      "--aggregator", "sum,value",
    ]);
    op.finish();
    expect(collector.records.length).toBe(0);
  });
});
