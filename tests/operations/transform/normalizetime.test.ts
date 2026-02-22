import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { NormalizeTimeOperation } from "../../../src/operations/transform/normalizetime.ts";

function makeOp(args: string[]): { op: NormalizeTimeOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new NormalizeTimeOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: NormalizeTimeOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("NormalizeTimeOperation", () => {
  test("normalizes epoch time with strict mode", () => {
    const { op, collector } = makeOp(["--key", "time", "--epoch", "--threshold", "60", "--strict"]);
    feedRecords(op, [
      new Record({ time: 3600 }),  // 1:00:00
      new Record({ time: 3614 }),  // 1:00:14
      new Record({ time: 3659 }),  // 1:00:59
      new Record({ time: 3725 }),  // 1:02:05
    ]);

    expect(collector.records.length).toBe(4);
    expect(collector.records[0]!.get("n_time")).toBe(3600);
    expect(collector.records[1]!.get("n_time")).toBe(3600);
    expect(collector.records[2]!.get("n_time")).toBe(3600);
    expect(collector.records[3]!.get("n_time")).toBe(3720);
  });

  test("normalizes with non-strict mode (default)", () => {
    const { op, collector } = makeOp(["--key", "time", "--epoch", "--threshold", "60"]);
    feedRecords(op, [
      new Record({ time: 3600 }),  // 1:00:00 -> 3600
      new Record({ time: 3659 }),  // 1:00:59 -> 3600 (same bucket)
      new Record({ time: 3725 }),  // 1:02:05 -> 3720
      new Record({ time: 3775 }),  // 1:02:55 -> 3720
      new Record({ time: 3795 }),  // 1:03:15 -> 3720 (prior period matches)
    ]);

    expect(collector.records[0]!.get("n_time")).toBe(3600);
    expect(collector.records[1]!.get("n_time")).toBe(3600);
    expect(collector.records[2]!.get("n_time")).toBe(3720);
    expect(collector.records[3]!.get("n_time")).toBe(3720);
    // 3795 floor is 3780, prior=3720, prior period=3720, which matches
    expect(collector.records[4]!.get("n_time")).toBe(3720);
  });

  test("duration string parsing", () => {
    const { op, collector } = makeOp(["--key", "time", "--epoch", "--strict", "--threshold", "5 minutes"]);
    feedRecords(op, [
      new Record({ time: 0 }),
      new Record({ time: 299 }),
      new Record({ time: 300 }),
    ]);

    expect(collector.records[0]!.get("n_time")).toBe(0);
    expect(collector.records[1]!.get("n_time")).toBe(0);
    expect(collector.records[2]!.get("n_time")).toBe(300);
  });

  test("requires key", () => {
    expect(() => {
      makeOp(["--threshold", "60"]);
    }).toThrow("Must specify --key");
  });

  test("requires threshold", () => {
    expect(() => {
      makeOp(["--key", "time"]);
    }).toThrow("Must specify --threshold");
  });

  test("sanitizes key name for output field", () => {
    const { op, collector } = makeOp(["--key", "a/b", "--epoch", "--threshold", "60"]);
    op.acceptRecord(new Record({ a: { b: 3600 } }));
    op.finish();

    expect(collector.records[0]!.get("n_a_b")).toBe(3600);
  });
});
