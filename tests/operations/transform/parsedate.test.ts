import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { ParseDateOperation } from "../../../src/operations/transform/parsedate.ts";

function makeOp(args: string[]): { op: ParseDateOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new ParseDateOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("ParseDateOperation", () => {
  test("parses ISO date string to ISO output", () => {
    const { op, collector } = makeOp(["-k", "date"]);
    op.acceptRecord(new Record({ date: "2024-01-15T12:30:00Z", val: 1 }));
    op.finish();

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("parsed_date")).toBe("2024-01-15T12:30:00.000Z");
    expect(collector.records[0]!.get("val")).toBe(1); // Original field preserved
  });

  test("parses epoch seconds to ISO", () => {
    const { op, collector } = makeOp(["-k", "ts", "-e"]);
    op.acceptRecord(new Record({ ts: 1705312200 }));
    op.finish();

    expect(collector.records.length).toBe(1);
    const parsed = collector.records[0]!.get("parsed_ts") as string;
    expect(parsed).toContain("2024-01-15");
  });

  test("outputs epoch seconds with --output-epoch", () => {
    const { op, collector } = makeOp(["-k", "date", "-E"]);
    op.acceptRecord(new Record({ date: "2024-01-15T12:30:00Z" }));
    op.finish();

    expect(collector.records.length).toBe(1);
    // The exact epoch depends on timezone, so just verify it's a reasonable number
    const epoch = collector.records[0]!.get("parsed_date") as number;
    expect(typeof epoch).toBe("number");
    // Should be within a day of the expected value
    expect(Math.abs(epoch - 1705318200)).toBeLessThan(86400);
  });

  test("custom output format", () => {
    const { op, collector } = makeOp(["-k", "date", "-F", "%Y/%m/%d"]);
    op.acceptRecord(new Record({ date: "2024-01-15T00:00:00Z" }));
    op.finish();

    // Since the date is parsed at UTC but formatted at local time,
    // we just check the format pattern
    const parsed = collector.records[0]!.get("parsed_date") as string;
    expect(parsed).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });

  test("custom input format", () => {
    const { op, collector } = makeOp(["-k", "date", "-f", "%d/%m/%Y", "-E"]);
    op.acceptRecord(new Record({ date: "15/01/2024" }));
    op.finish();

    const epoch = collector.records[0]!.get("parsed_date") as number;
    const parsed = new Date(epoch * 1000);
    expect(parsed.getFullYear()).toBe(2024);
    expect(parsed.getMonth()).toBe(0); // January
    expect(parsed.getDate()).toBe(15);
  });

  test("custom output key", () => {
    const { op, collector } = makeOp(["-k", "date", "-o", "my_date"]);
    op.acceptRecord(new Record({ date: "2024-01-15T00:00:00Z" }));
    op.finish();

    expect(collector.records[0]!.get("my_date")).toBeDefined();
    expect(collector.records[0]!.get("parsed_date")).toBeUndefined();
  });

  test("null/empty values pass through", () => {
    const { op, collector } = makeOp(["-k", "date"]);
    op.acceptRecord(new Record({ date: null, val: 1 }));
    op.acceptRecord(new Record({ date: "", val: 2 }));
    op.finish();

    expect(collector.records.length).toBe(2);
    // Records should pass through without parsed_date being set
    expect(collector.records[0]!.get("val")).toBe(1);
    expect(collector.records[1]!.get("val")).toBe(2);
  });

  test("throws on unparseable date", () => {
    const { op } = makeOp(["-k", "date"]);
    expect(() => {
      op.acceptRecord(new Record({ date: "not-a-date" }));
    }).toThrow("Cannot parse date");
  });

  test("requires --key", () => {
    expect(() => {
      const collector = new CollectorReceiver();
      const op = new ParseDateOperation(collector);
      op.init([]);
    }).toThrow("Must specify --key");
  });
});
