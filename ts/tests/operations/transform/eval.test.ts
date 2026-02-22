import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { EvalOperation } from "../../../src/operations/transform/eval.ts";
import type { RecordReceiver } from "../../../src/Operation.ts";

class LineCollector implements RecordReceiver {
  lines: string[] = [];
  records: Record[] = [];

  acceptRecord(record: Record): boolean {
    this.records.push(record);
    return true;
  }

  acceptLine(line: string): boolean {
    this.lines.push(line);
    return true;
  }

  finish(): void {
    // no-op
  }
}

function makeOp(args: string[]): { op: EvalOperation; collector: LineCollector } {
  const collector = new LineCollector();
  const op = new EvalOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("EvalOperation", () => {
  test("evaluates expression and outputs as line", () => {
    const { op, collector } = makeOp(["return {{host}}"]);
    op.acceptRecord(new Record({ host: "example.com" }));
    op.finish();

    expect(collector.lines.length).toBe(1);
    expect(collector.lines[0]).toBe("example.com");
  });

  test("evaluates numeric expressions", () => {
    const { op, collector } = makeOp(["return {{x}} + {{y}}"]);
    op.acceptRecord(new Record({ x: 3, y: 4 }));
    op.finish();

    expect(collector.lines[0]).toBe("7");
  });

  test("concatenation expression", () => {
    const { op, collector } = makeOp(["return {{x}} + ' ' + {{y}}"]);
    op.acceptRecord(new Record({ x: "hello", y: "world" }));
    op.finish();

    expect(collector.lines[0]).toBe("hello world");
  });

  test("does not output records", () => {
    const { op } = makeOp(["return 'test'"]);
    expect(op.doesRecordOutput()).toBe(false);
  });

  test("requires expression", () => {
    expect(() => {
      const collector = new LineCollector();
      const op = new EvalOperation(collector);
      op.init([]);
    }).toThrow("eval requires an expression");
  });
});
