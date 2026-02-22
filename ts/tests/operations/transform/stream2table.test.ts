import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { Stream2TableOperation } from "../../../src/operations/transform/stream2table.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function makeOp(args: string[]): { op: Stream2TableOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new Stream2TableOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: Stream2TableOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("Stream2TableOperation", () => {
  test("groups records by column field", () => {
    const { op, collector } = makeOp(["--field", "column"]);
    feedRecords(op, [
      new Record({ column: "foo", data: "foo1" }),
      new Record({ column: "foo", data: "foo2" }),
      new Record({ column: "boo", data: "boo1" }),
      new Record({ column: "boo", data: "boo2" }),
    ]);

    expect(collector.records.length).toBe(2);
    // First output record has first of each group
    const r0 = collector.records[0]!;
    const foo0 = r0.get("foo") as JsonObject;
    const boo0 = r0.get("boo") as JsonObject;
    expect(foo0["data"]).toBe("foo1");
    expect(boo0["data"]).toBe("boo1");

    // Second output record has second of each group
    const r1 = collector.records[1]!;
    const foo1 = r1.get("foo") as JsonObject;
    const boo1 = r1.get("boo") as JsonObject;
    expect(foo1["data"]).toBe("foo2");
    expect(boo1["data"]).toBe("boo2");
  });

  test("removes column field from nested records", () => {
    const { op, collector } = makeOp(["--field", "column"]);
    feedRecords(op, [
      new Record({ column: "foo", data: "val" }),
    ]);

    const nested = collector.records[0]!.get("foo") as JsonObject;
    expect(nested["column"]).toBeUndefined();
    expect(nested["data"]).toBe("val");
  });

  test("requires field option", () => {
    expect(() => {
      makeOp([]);
    }).toThrow("You must specify a --field option");
  });

  test("uneven groups produce partial rows", () => {
    const { op, collector } = makeOp(["--field", "col"]);
    feedRecords(op, [
      new Record({ col: "a", v: 1 }),
      new Record({ col: "a", v: 2 }),
      new Record({ col: "b", v: 10 }),
    ]);

    expect(collector.records.length).toBe(2);
    // Row 1 has both a and b
    expect(collector.records[0]!.get("a")).toBeDefined();
    expect(collector.records[0]!.get("b")).toBeDefined();
    // Row 2 has only a
    expect(collector.records[1]!.get("a")).toBeDefined();
  });
});
