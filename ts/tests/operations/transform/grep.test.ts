import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { GrepOperation } from "../../../src/operations/transform/grep.ts";

function makeOp(args: string[]): { op: GrepOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new GrepOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: GrepOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("GrepOperation", () => {
  test("filters records by truthy expression", () => {
    const { op, collector } = makeOp(["{{x}} > 2"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 3 }),
      new Record({ x: 5 }),
      new Record({ x: 2 }),
    ]);

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("x")).toBe(3);
    expect(collector.records[1]!.get("x")).toBe(5);
  });

  test("anti-match with -v", () => {
    const { op, collector } = makeOp(["-v", "{{x}} > 2"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 3 }),
      new Record({ x: 5 }),
    ]);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("x")).toBe(1);
  });

  test("string equality check", () => {
    const { op, collector } = makeOp(["{{name}} === 'John'"]);
    feedRecords(op, [
      new Record({ name: "John" }),
      new Record({ name: "Jane" }),
      new Record({ name: "John" }),
    ]);

    expect(collector.records.length).toBe(2);
  });

  test("after context with -A", () => {
    const { op, collector } = makeOp(["--after-context", "1", "{{x}} === 3"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
      new Record({ x: 4 }),
      new Record({ x: 5 }),
    ]);

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("x")).toBe(3);
    expect(collector.records[1]!.get("x")).toBe(4);
  });

  test("before context with -B", () => {
    const { op, collector } = makeOp(["--before-context", "1", "{{x}} === 3"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
      new Record({ x: 4 }),
      new Record({ x: 5 }),
    ]);

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("x")).toBe(2);
    expect(collector.records[1]!.get("x")).toBe(3);
  });

  test("context with -C", () => {
    const { op, collector } = makeOp(["--context", "1", "{{x}} === 3"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
      new Record({ x: 4 }),
      new Record({ x: 5 }),
    ]);

    expect(collector.records.length).toBe(3);
    expect(collector.records[0]!.get("x")).toBe(2);
    expect(collector.records[1]!.get("x")).toBe(3);
    expect(collector.records[2]!.get("x")).toBe(4);
  });

  test("sets exit value 1 when no records match", () => {
    const { op } = makeOp(["{{x}} > 100"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ]);

    expect(op.getExitValue()).toBe(1);
  });

  test("exit value 0 when records match", () => {
    const { op } = makeOp(["{{x}} > 0"]);
    feedRecords(op, [
      new Record({ x: 1 }),
    ]);

    expect(op.getExitValue()).toBe(0);
  });

  test("requires expression", () => {
    expect(() => {
      makeOp([]);
    }).toThrow("grep requires an expression");
  });
});
