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

  test("push_output sends records directly to output", () => {
    const { op, collector } = makeOp([
      "push_output({x: r.get('a') * 10}); push_output({x: r.get('a') * 100})",
    ]);
    feedRecords(op, [
      new Record({ a: 2 }),
      new Record({ a: 3 }),
    ]);

    expect(collector.records.length).toBe(4);
    expect(collector.records[0]!.get("x")).toBe(20);
    expect(collector.records[1]!.get("x")).toBe(200);
    expect(collector.records[2]!.get("x")).toBe(30);
    expect(collector.records[3]!.get("x")).toBe(300);
  });

  test("push_input re-injects records into the input stream", () => {
    // Use push_input to duplicate a record with a marker, but only once
    const { op, collector } = makeOp([
      "if (!r.get('dup')) { push_input({a: r.get('a'), dup: true}) }",
    ]);
    feedRecords(op, [
      new Record({ a: 1 }),
    ]);

    // The original is suppressed (push_input sets suppressR), then the
    // duplicated record {a:1, dup:true} is re-processed and output normally
    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("a")).toBe(1);
    expect(collector.records[0]!.get("dup")).toBe(true);
  });

  test("push_output suppresses default record output", () => {
    const { op, collector } = makeOp(["push_output({out: true})"]);
    feedRecords(op, [
      new Record({ a: 1 }),
    ]);

    // Only the pushed record should appear, not the original
    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("out")).toBe(true);
  });

  test("push_output works in post-snippet", () => {
    const { op, collector } = makeOp([
      "--post-snippet", "push_output({done: true})",
      "r.set('seen', true)",
    ]);
    feedRecords(op, [
      new Record({ a: 1 }),
    ]);

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("seen")).toBe(true);
    expect(collector.records[1]!.get("done")).toBe(true);
  });
});
