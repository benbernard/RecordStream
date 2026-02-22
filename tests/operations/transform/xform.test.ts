import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { XformOperation } from "../../../src/operations/transform/xform.ts";

function makeOp(args: string[]): { op: XformOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new XformOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: XformOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("XformOperation", () => {
  test("modifies records in place", () => {
    const { op, collector } = makeOp(["{{line}} = $line"]);
    feedRecords(op, [
      new Record({ a: 1 }),
      new Record({ a: 2 }),
    ]);

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("line")).toBe(1);
    expect(collector.records[1]!.get("line")).toBe(2);
  });

  test("can add new fields", () => {
    const { op, collector } = makeOp(["{{sum}} = {{x}} + {{y}}"]);
    feedRecords(op, [
      new Record({ x: 3, y: 4 }),
    ]);

    expect(collector.records[0]!.get("sum")).toBe(7);
  });

  test("returns array to split records", () => {
    const { op, collector } = makeOp(["return [{a: 1}, {a: 2}]"]);
    feedRecords(op, [
      new Record({ x: 1 }),
    ]);

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("a")).toBe(1);
    expect(collector.records[1]!.get("a")).toBe(2);
  });

  test("requires expression", () => {
    expect(() => {
      makeOp([]);
    }).toThrow("xform requires an expression");
  });
});
