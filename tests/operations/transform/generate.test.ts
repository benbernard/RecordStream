import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { GenerateOperation } from "../../../src/operations/transform/generate.ts";

function makeOp(args: string[]): { op: GenerateOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new GenerateOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("GenerateOperation", () => {
  test("generates records from snippet returning array", () => {
    const { op, collector } = makeOp([
      "return [{title: 'a'}, {title: 'b'}]",
    ]);

    op.acceptRecord(new Record({ id: 1 }));
    op.finish();

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("title")).toBe("a");
    expect(collector.records[1]!.get("title")).toBe("b");
    // Chain link should be present
    const chain0 = collector.records[0]!.get("_chain") as { id: number };
    expect(chain0.id).toBe(1);
  });

  test("passthrough emits input record too", () => {
    const { op, collector } = makeOp([
      "--passthrough",
      "return [{title: 'generated'}]",
    ]);

    op.acceptRecord(new Record({ id: 1 }));
    op.finish();

    expect(collector.records.length).toBe(2);
    // First record is the passthrough of original
    expect(collector.records[0]!.get("id")).toBe(1);
    // Second record is the generated one
    expect(collector.records[1]!.get("title")).toBe("generated");
  });

  test("custom keychain name", () => {
    const { op, collector } = makeOp([
      "--keychain", "source",
      "return [{x: 1}]",
    ]);

    op.acceptRecord(new Record({ id: 42 }));
    op.finish();

    expect(collector.records[0]!.get("source")).toBeDefined();
    const source = collector.records[0]!.get("source") as { id: number };
    expect(source.id).toBe(42);
  });

  test("requires expression", () => {
    expect(() => {
      makeOp([]);
    }).toThrow("generate requires an expression");
  });
});
