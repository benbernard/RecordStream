import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver, Operation } from "../../../src/Operation.ts";
import type { RecordReceiver } from "../../../src/Operation.ts";
import {
  ChainOperation,
  registerOperationFactory,
} from "../../../src/operations/transform/chain.ts";

// Register a simple test operation
class DoubleFieldOp extends Operation {
  field = "x";

  init(args: string[]): void {
    if (args.length > 0) {
      this.field = args[0]!;
    }
  }

  acceptRecord(record: Record): boolean {
    const val = record.get(this.field);
    if (typeof val === "number") {
      record.set(this.field, val * 2);
    }
    return this.pushRecord(record);
  }
}

class AddFieldOp extends Operation {
  init(_args: string[]): void {
    // no-op
  }

  acceptRecord(record: Record): boolean {
    record.set("added", true);
    return this.pushRecord(record);
  }
}

registerOperationFactory("double", (next: RecordReceiver) => new DoubleFieldOp(next));
registerOperationFactory("add-field", (next: RecordReceiver) => new AddFieldOp(next));

describe("ChainOperation", () => {
  test("chains operations together", () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["double", "x", "|", "add-field"]);

    chain.feedRecords([
      new Record({ x: 5 }),
      new Record({ x: 10 }),
    ]);
    chain.finish();

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("x")).toBe(10);
    expect(collector.records[0]!.get("added")).toBe(true);
    expect(collector.records[1]!.get("x")).toBe(20);
  });

  test("single operation in chain", () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["double", "x"]);

    chain.feedRecords([new Record({ x: 3 })]);
    chain.finish();

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("x")).toBe(6);
  });

  test("empty chain does nothing", () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init([]);
    chain.finish();

    expect(collector.records.length).toBe(0);
  });
});
