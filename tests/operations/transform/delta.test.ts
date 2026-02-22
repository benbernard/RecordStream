import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { DeltaOperation } from "../../../src/operations/transform/delta.ts";

function makeOp(args: string[]): { op: DeltaOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new DeltaOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: DeltaOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("DeltaOperation", () => {
  test("computes deltas between consecutive records", () => {
    const { op, collector } = makeOp(["--key", "errors"]);
    feedRecords(op, [
      new Record({ errors: 10, host: "a" }),
      new Record({ errors: 15, host: "b" }),
      new Record({ errors: 25, host: "c" }),
    ]);

    // Outputs n-1 records (first pair, second pair)
    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("errors")).toBe(5);
    expect(collector.records[0]!.get("host")).toBe("a");
    expect(collector.records[1]!.get("errors")).toBe(10);
    expect(collector.records[1]!.get("host")).toBe("b");
  });

  test("handles null values", () => {
    const { op, collector } = makeOp(["--key", "x"]);
    feedRecords(op, [
      new Record({ x: 10 }),
      new Record({ x: null }),
    ]);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("x")).toBe(null);
  });

  test("requires --key", () => {
    expect(() => {
      makeOp([]);
    }).toThrow("Must specify --key");
  });

  test("preserves non-delta fields from first record of pair", () => {
    const { op, collector } = makeOp(["--key", "val"]);
    feedRecords(op, [
      new Record({ val: 10, name: "first" }),
      new Record({ val: 20, name: "second" }),
    ]);

    expect(collector.records[0]!.get("val")).toBe(10);
    expect(collector.records[0]!.get("name")).toBe("first");
  });
});
