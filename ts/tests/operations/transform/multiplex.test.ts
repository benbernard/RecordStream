import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver, Operation } from "../../../src/Operation.ts";
import type { RecordReceiver } from "../../../src/Operation.ts";
import { MultiplexOperation } from "../../../src/operations/transform/multiplex.ts";
import { registerOperationFactory } from "../../../src/operations/transform/chain.ts";

// Register a test passthrough operation so multiplex can create it
class PassthroughOp extends Operation {
  init(_args: string[]): void {
    // no-op
  }
  acceptRecord(record: Record): boolean {
    return this.pushRecord(record);
  }
}

registerOperationFactory("passthrough", (next: RecordReceiver) => new PassthroughOp(next));

function makeOp(args: string[]): { op: MultiplexOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new MultiplexOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: MultiplexOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("MultiplexOperation", () => {
  test("basic passthrough multiplex", () => {
    const { op, collector } = makeOp(["passthrough"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ]);

    // Passthrough operation just passes records through
    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("x")).toBe(1);
    expect(collector.records[1]!.get("x")).toBe(2);
  });

  test("multiplex with key grouping", () => {
    const { op, collector } = makeOp(["-k", "group", "passthrough"]);
    feedRecords(op, [
      new Record({ group: "a", val: 1 }),
      new Record({ group: "a", val: 2 }),
      new Record({ group: "b", val: 3 }),
    ]);

    // All records pass through, grouped by key
    expect(collector.records.length).toBe(3);
  });

  test("requires operation name", () => {
    expect(() => {
      makeOp([]);
    }).toThrow("multiplex requires an operation");
  });
});
