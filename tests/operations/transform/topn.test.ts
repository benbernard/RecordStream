import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { TopnOperation } from "../../../src/operations/transform/topn.ts";

function makeOp(args: string[]): { op: TopnOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new TopnOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: TopnOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("TopnOperation", () => {
  test("returns first N records (default 10)", () => {
    const { op, collector } = makeOp([]);
    const records = Array.from({ length: 20 }, (_, i) => new Record({ x: i }));
    feedRecords(op, records);

    expect(collector.records.length).toBe(10);
    expect(collector.records[0]!.get("x")).toBe(0);
    expect(collector.records[9]!.get("x")).toBe(9);
  });

  test("returns first N records with custom N", () => {
    const { op, collector } = makeOp(["--topn", "3"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
      new Record({ x: 4 }),
      new Record({ x: 5 }),
    ]);

    expect(collector.records.length).toBe(3);
    expect(collector.records.map((r) => r.get("x"))).toEqual([1, 2, 3]);
  });

  test("top N per key group", () => {
    const { op, collector } = makeOp(["--topn", "2", "--key", "area"]);
    feedRecords(op, [
      new Record({ area: "A", val: 1 }),
      new Record({ area: "A", val: 2 }),
      new Record({ area: "A", val: 3 }),
      new Record({ area: "B", val: 1 }),
      new Record({ area: "B", val: 2 }),
      new Record({ area: "B", val: 3 }),
    ]);

    expect(collector.records.length).toBe(4);
    const aRecords = collector.records.filter((r) => r.get("area") === "A");
    const bRecords = collector.records.filter((r) => r.get("area") === "B");
    expect(aRecords.length).toBe(2);
    expect(bRecords.length).toBe(2);
  });

  test("short flag -n", () => {
    const { op, collector } = makeOp(["-n", "2"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ]);

    expect(collector.records.length).toBe(2);
  });
});
