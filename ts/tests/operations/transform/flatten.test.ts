import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { FlattenOperation } from "../../../src/operations/transform/flatten.ts";

function makeOp(args: string[]): { op: FlattenOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new FlattenOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("FlattenOperation", () => {
  test("flattens a hash one level", () => {
    const { op, collector } = makeOp(["--key", "field"]);
    op.acceptRecord(new Record({ field: { subfield: "value" } }));
    op.finish();

    expect(collector.records.length).toBe(1);
    const r = collector.records[0]!;
    expect(r.get("field-subfield")).toBe("value");
    expect(r.get("field")).toBeUndefined();
  });

  test("flattens an array one level", () => {
    const { op, collector } = makeOp(["--key", "field"]);
    op.acceptRecord(new Record({ field: ["value1", "value2"] }));
    op.finish();

    const r = collector.records[0]!;
    expect(r.get("field-0")).toBe("value1");
    expect(r.get("field-1")).toBe("value2");
  });

  test("scalar value passes through unchanged", () => {
    const { op, collector } = makeOp(["--key", "field"]);
    op.acceptRecord(new Record({ field: "value" }));
    op.finish();

    expect(collector.records[0]!.get("field")).toBe("value");
  });

  test("deep flatten", () => {
    const { op, collector } = makeOp(["--deep", "x"]);
    op.acceptRecord(new Record({ x: { y: [{ z: "v" }] } }));
    op.finish();

    expect(collector.records[0]!.get("x-y-0-z")).toBe("v");
  });

  test("custom separator", () => {
    const { op, collector } = makeOp(["--key", "field", "--separator", "_"]);
    op.acceptRecord(new Record({ field: { sub: "val" } }));
    op.finish();

    expect(collector.records[0]!.get("field_sub")).toBe("val");
  });

  test("depth 1 stops at one level", () => {
    const { op, collector } = makeOp(["--key", "field"]);
    op.acceptRecord(new Record({ field: { sub: [0, 1] } }));
    op.finish();

    const r = collector.records[0]!;
    // At depth 1, sub should be flattened but its array value kept as-is
    expect(r.get("field-sub")).toEqual([0, 1]);
  });
});
