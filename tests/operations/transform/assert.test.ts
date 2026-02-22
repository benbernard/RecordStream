import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { AssertOperation } from "../../../src/operations/transform/assert.ts";

function makeOp(args: string[]): { op: AssertOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new AssertOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("AssertOperation", () => {
  test("passes records when assertion is true", () => {
    const { op, collector } = makeOp(["return {{x}} > 0"]);
    op.acceptRecord(new Record({ x: 5 }));
    op.acceptRecord(new Record({ x: 10 }));
    op.finish();

    expect(collector.records.length).toBe(2);
  });

  test("throws when assertion fails", () => {
    const { op } = makeOp(["return {{x}} > 0"]);
    expect(() => {
      op.acceptRecord(new Record({ x: -1 }));
    }).toThrow("Assertion failed!");
  });

  test("includes diagnostic in error message", () => {
    const { op } = makeOp(["--diagnostic", "x must be positive", "return {{x}} > 0"]);
    expect(() => {
      op.acceptRecord(new Record({ x: -1 }));
    }).toThrow("x must be positive");
  });

  test("verbose includes record dump", () => {
    const { op } = makeOp(["--verbose", "return {{x}} > 0"]);
    try {
      op.acceptRecord(new Record({ x: -1 }));
    } catch (e) {
      expect((e as Error).message).toContain('"x": -1');
    }
  });

  test("requires expression", () => {
    expect(() => {
      makeOp([]);
    }).toThrow("assert requires an expression");
  });
});
