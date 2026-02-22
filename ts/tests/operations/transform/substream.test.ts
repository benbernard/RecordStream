import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { SubstreamOperation } from "../../../src/operations/transform/substream.ts";

function makeOp(args: string[]): { op: SubstreamOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new SubstreamOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: SubstreamOperation, records: Record[]): void {
  for (const r of records) {
    if (!op.acceptRecord(r)) break;
  }
  op.finish();
}

describe("SubstreamOperation", () => {
  test("begin and end delimiters", () => {
    const { op, collector } = makeOp([
      "--begin", "return {{x}} === 3",
      "--end", "return {{x}} === 5",
    ]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
      new Record({ x: 4 }),
      new Record({ x: 5 }),
      new Record({ x: 6 }),
    ]);

    expect(collector.records.length).toBe(3);
    expect(collector.records[0]!.get("x")).toBe(3);
    expect(collector.records[1]!.get("x")).toBe(4);
    expect(collector.records[2]!.get("x")).toBe(5);
  });

  test("begin only - outputs from start point to end", () => {
    const { op, collector } = makeOp([
      "--begin", "return {{x}} === 3",
    ]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
      new Record({ x: 4 }),
      new Record({ x: 5 }),
    ]);

    expect(collector.records.length).toBe(3);
    expect(collector.records[0]!.get("x")).toBe(3);
  });

  test("end only - outputs from beginning to end point", () => {
    const { op, collector } = makeOp([
      "--end", "return {{x}} === 3",
    ]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
      new Record({ x: 4 }),
      new Record({ x: 5 }),
    ]);

    expect(collector.records.length).toBe(3);
    expect(collector.records[0]!.get("x")).toBe(1);
    expect(collector.records[2]!.get("x")).toBe(3);
  });

  test("no match sets exit value 1", () => {
    const { op } = makeOp([
      "--begin", "return {{x}} === 999",
    ]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ]);

    expect(op.getExitValue()).toBe(1);
  });
});
