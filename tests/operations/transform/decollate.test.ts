import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { DecollateOperation } from "../../../src/operations/transform/decollate.ts";
import { deaggregatorRegistry } from "../../../src/Deaggregator.ts";
import type { Deaggregator } from "../../../src/Deaggregator.ts";

function registerTestDeaggregators(): void {
  if (deaggregatorRegistry.has("split")) return;

  deaggregatorRegistry.register("split", {
    create: (field: string, delim: string, outputField: string) => ({
      deaggregate: (record: Record): Record[] => {
        const val = record.get(field);
        if (typeof val !== "string") return [new Record()];
        const parts = val.split(delim);
        return parts.map((part) => new Record({ [outputField]: part }));
      },
    }) as Deaggregator,
    argCounts: [3],
    shortUsage: "Split a field",
    longUsage: "Splits a field by delimiter into separate records",
  });
}

function makeOp(args: string[]): { op: DecollateOperation; collector: CollectorReceiver } {
  registerTestDeaggregators();
  const collector = new CollectorReceiver();
  const op = new DecollateOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("DecollateOperation", () => {
  test("applies deaggregator to split records", () => {
    const { op, collector } = makeOp(["--deaggregator", "split,hosts, ,host"]);

    op.acceptRecord(new Record({ hosts: "a b c", group: "g1" }));
    op.finish();

    expect(collector.records.length).toBe(3);
    // Each record should have the original fields plus the deaggregated field
    expect(collector.records[0]!.get("host")).toBe("a");
    expect(collector.records[0]!.get("group")).toBe("g1");
    expect(collector.records[1]!.get("host")).toBe("b");
    expect(collector.records[2]!.get("host")).toBe("c");
  });

  test("multiple input records", () => {
    const { op, collector } = makeOp(["--deaggregator", "split,items,-,item"]);

    op.acceptRecord(new Record({ items: "x-y" }));
    op.acceptRecord(new Record({ items: "a-b-c" }));
    op.finish();

    expect(collector.records.length).toBe(5);
  });
});
