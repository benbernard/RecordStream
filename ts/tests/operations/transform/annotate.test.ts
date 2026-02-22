import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { AnnotateOperation } from "../../../src/operations/transform/annotate.ts";

function makeOp(args: string[]): { op: AnnotateOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new AnnotateOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("AnnotateOperation", () => {
  test("caches annotations by key", () => {
    const { op, collector } = makeOp(["--keys", "name", "{{count}} = 42"]);

    op.acceptRecord(new Record({ name: "foo", x: 1 }));
    op.acceptRecord(new Record({ name: "foo", x: 2 }));
    op.acceptRecord(new Record({ name: "bar", x: 3 }));
    op.finish();

    expect(collector.records.length).toBe(3);
    // All foo records should have count=42
    expect(collector.records[0]!.get("count")).toBe(42);
    expect(collector.records[1]!.get("count")).toBe(42);
    // bar record also gets count=42 (new annotation)
    expect(collector.records[2]!.get("count")).toBe(42);
  });

  test("requires at least one key", () => {
    expect(() => {
      makeOp(["{{count}} = 42"]);
    }).toThrow("Must specify at least one --key");
  });

  test("different key values get separate annotations", () => {
    // The expression uses the record value, so different keys give different results
    const { op, collector } = makeOp(["--keys", "name", "{{doubled}} = {{x}} * 2"]);

    op.acceptRecord(new Record({ name: "foo", x: 5 }));
    op.acceptRecord(new Record({ name: "bar", x: 10 }));
    op.acceptRecord(new Record({ name: "foo", x: 999 })); // should use cached value from first foo
    op.finish();

    expect(collector.records[0]!.get("doubled")).toBe(10);
    expect(collector.records[1]!.get("doubled")).toBe(20);
    expect(collector.records[2]!.get("doubled")).toBe(10); // cached from first foo
  });
});
