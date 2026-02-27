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

  describe("--shell mode", () => {
    test("basic shell command execution", () => {
      const { op, collector } = makeOp([
        "--shell",
        'echo \'{"x": 1}\'',
      ]);

      op.acceptRecord(new Record({ id: 1 }));
      op.finish();

      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("x")).toBe(1);
      // Chain link should be present
      const chain = collector.records[0]!.get("_chain") as { id: number };
      expect(chain.id).toBe(1);
    });

    test("shell command that outputs multiple JSON records", () => {
      const { op, collector } = makeOp([
        "--shell",
        'printf \'{"a": 1}\\n{"a": 2}\\n{"a": 3}\\n\'',
      ]);

      op.acceptRecord(new Record({ id: 10 }));
      op.finish();

      expect(collector.records.length).toBe(3);
      expect(collector.records[0]!.get("a")).toBe(1);
      expect(collector.records[1]!.get("a")).toBe(2);
      expect(collector.records[2]!.get("a")).toBe(3);
      // All should chain back to the input record
      for (const rec of collector.records) {
        const chain = rec.get("_chain") as { id: number };
        expect(chain.id).toBe(10);
      }
    });

    test("shell command with template interpolation", () => {
      const { op, collector } = makeOp([
        "--shell",
        'echo \'{"greeting": "hello {{name}}"}\'',
      ]);

      op.acceptRecord(new Record({ name: "world" }));
      op.finish();

      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("greeting")).toBe("hello world");
    });

    test("shell command with passthrough", () => {
      const { op, collector } = makeOp([
        "--shell", "--passthrough",
        'echo \'{"x": 1}\'',
      ]);

      op.acceptRecord(new Record({ id: 5 }));
      op.finish();

      expect(collector.records.length).toBe(2);
      // First record is the passthrough
      expect(collector.records[0]!.get("id")).toBe(5);
      // Second is the generated one
      expect(collector.records[1]!.get("x")).toBe(1);
    });

    test("error handling for failed shell commands", () => {
      const stderrMessages: string[] = [];
      const origWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrMessages.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      try {
        const { op, collector } = makeOp([
          "--shell",
          "exit 1",
        ]);

        op.acceptRecord(new Record({ id: 1 }));
        op.finish();

        // No records should be generated
        expect(collector.records.length).toBe(0);
        // Should have written an error to stderr
        expect(stderrMessages.some(m => m.includes("exited with status 1"))).toBe(true);
      } finally {
        process.stderr.write = origWrite;
      }
    });

    test("shell command with invalid JSON output writes error to stderr", () => {
      const stderrMessages: string[] = [];
      const origWrite = process.stderr.write;
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrMessages.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      try {
        const { op, collector } = makeOp([
          "--shell",
          "echo not-json",
        ]);

        op.acceptRecord(new Record({ id: 1 }));
        op.finish();

        expect(collector.records.length).toBe(0);
        expect(stderrMessages.some(m => m.includes("failed to parse JSON"))).toBe(true);
      } finally {
        process.stderr.write = origWrite;
      }
    });

    test("shell command per record with different interpolations", () => {
      const { op, collector } = makeOp([
        "--shell",
        'echo \'{"val": {{count}}}\'',
      ]);

      op.acceptRecord(new Record({ count: 10 }));
      op.acceptRecord(new Record({ count: 20 }));
      op.finish();

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("val")).toBe(10);
      expect(collector.records[1]!.get("val")).toBe(20);
    });
  });
});
