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

  test("multi-unit duration parsing", () => {
    // "1 hour 30 minutes" = 5400 seconds
    const { op, collector } = makeOp(["--key", "time", "--epoch", "--strict", "--threshold", "1 hour 30 minutes"]);
    feedRecords(op, [
      new Record({ time: 0 }),
      new Record({ time: 5399 }),
      new Record({ time: 5400 }),
      new Record({ time: 10799 }),
      new Record({ time: 10800 }),
    ]);

    expect(collector.records[0]!.get("n_time")).toBe(0);
    expect(collector.records[1]!.get("n_time")).toBe(0);
    expect(collector.records[2]!.get("n_time")).toBe(5400);
    expect(collector.records[3]!.get("n_time")).toBe(5400);
    expect(collector.records[4]!.get("n_time")).toBe(10800);
  });

  test("multi-unit duration with abbreviated units", () => {
    // "3d 2h" = 3*86400 + 2*3600 = 266400 seconds
    const { op } = makeOp(["--key", "time", "--epoch", "--strict", "--threshold", "3d 2h"]);
    expect(op.threshold).toBe(266400);
  });

  test("multi-unit duration with days and hours and minutes", () => {
    // "1 day 2 hours 30 minutes" = 86400 + 7200 + 1800 = 95400
    const { op } = makeOp(["--key", "time", "--epoch", "--strict", "--threshold", "1 day 2 hours 30 minutes"]);
    expect(op.threshold).toBe(95400);
  });

  test("parses date strings with chrono-node", () => {
    // Use a clearly parseable date string format
    const { op, collector } = makeOp(["--key", "date", "--threshold", "3600", "--strict"]);
    feedRecords(op, [
      new Record({ date: "June 12, 2009 1:00:00 UTC" }),
      new Record({ date: "June 12, 2009 1:30:00 UTC" }),
      new Record({ date: "June 12, 2009 2:00:00 UTC" }),
    ]);

    expect(collector.records.length).toBe(3);
    // All should be normalized to hour boundaries
    const t0 = collector.records[0]!.get("n_date") as number;
    const t1 = collector.records[1]!.get("n_date") as number;
    const t2 = collector.records[2]!.get("n_date") as number;
    expect(t0).toBe(t1); // same hour
    expect(t2).toBe(t0 + 3600); // next hour
  });

  test("parses non-standard date formats via chrono-node", () => {
    // "December 25th 2020" is not reliably parsed by native Date() but chrono-node handles it
    const { op, collector } = makeOp(["--key", "date", "--threshold", "86400", "--strict"]);
    feedRecords(op, [
      new Record({ date: "December 25th 2020 12:00:00" }),
    ]);

    expect(collector.records.length).toBe(1);
    const normalized = collector.records[0]!.get("n_date") as number;
    expect(normalized).toBeGreaterThan(0);
  });

  test("throws on unparseable date", () => {
    const { op } = makeOp(["--key", "date", "--threshold", "60"]);
    expect(() => {
      op.acceptRecord(new Record({ date: "not-a-date-at-all-xyz" }));
    }).toThrow("Cannot parse date from key: date");
  });

  test("throws on invalid duration string", () => {
    expect(() => {
      makeOp(["--key", "time", "--epoch", "--threshold", "foobar"]);
    }).toThrow("Cannot parse duration");
  });

  test("throws on unknown duration unit", () => {
    expect(() => {
      makeOp(["--key", "time", "--epoch", "--threshold", "5 fortnights"]);
    }).toThrow("Unknown duration unit");
  });
});
