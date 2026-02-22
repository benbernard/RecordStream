import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";
import { PythonSnippetRunner } from "../../src/snippets/PythonSnippetRunner.ts";
import { CollectorReceiver } from "../../src/Operation.ts";
import { EvalOperation } from "../../src/operations/transform/eval.ts";
import { GrepOperation } from "../../src/operations/transform/grep.ts";
import { XformOperation } from "../../src/operations/transform/xform.ts";
import { GenerateOperation } from "../../src/operations/transform/generate.ts";
import { AssertOperation } from "../../src/operations/transform/assert.ts";
import type { RecordReceiver } from "../../src/Operation.ts";

// ── Helpers ──────────────────────────────────────────────────────

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

  finish(): void {}
}

// ── Direct PythonSnippetRunner tests ─────────────────────────────

describe("PythonSnippetRunner (direct)", () => {
  describe("eval mode", () => {
    test("modifies record", () => {
      const runner = new PythonSnippetRunner();
      void runner.init("r['doubled'] = r['val'] * 2", { mode: "eval" });

      const results = runner.executeBatch([new Record({ val: 21 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.record!["val"]).toBe(21);
      expect(results[0]!.record!["doubled"]).toBe(42);
    });

    test("handles multiple records", () => {
      const runner = new PythonSnippetRunner();
      void runner.init("r['x'] = r['x'] * 2", { mode: "eval" });

      const results = runner.executeBatch([
        new Record({ x: 1 }),
        new Record({ x: 5 }),
        new Record({ x: 10 }),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]!.record!["x"]).toBe(2);
      expect(results[1]!.record!["x"]).toBe(10);
      expect(results[2]!.record!["x"]).toBe(20);
    });
  });

  describe("grep mode", () => {
    test("filters records", () => {
      const runner = new PythonSnippetRunner();
      void runner.init("r['age'] > 25", { mode: "grep" });

      const results = runner.executeBatch([
        new Record({ name: "alice", age: 30 }),
        new Record({ name: "bob", age: 20 }),
        new Record({ name: "carol", age: 35 }),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]!.passed).toBe(true);
      expect(results[1]!.passed).toBe(false);
      expect(results[2]!.passed).toBe(true);
    });
  });

  describe("xform mode", () => {
    test("emits multiple records", () => {
      const runner = new PythonSnippetRunner();
      void runner.init("emit({'a': 1})\nemit({'b': 2})", { mode: "xform" });

      const results = runner.executeBatch([new Record({ name: "input" })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.records).toHaveLength(2);
      expect(results[0]!.records![0]!["a"]).toBe(1);
      expect(results[0]!.records![1]!["b"]).toBe(2);
    });
  });

  describe("generate mode", () => {
    test("generates records from input", () => {
      const runner = new PythonSnippetRunner();
      void runner.init(
        "for i in range(3):\n    emit({'i': i, 'src': r['name']})",
        { mode: "generate" }
      );

      const results = runner.executeBatch([new Record({ name: "origin" })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.records).toHaveLength(3);
      expect(results[0]!.records![0]!["i"]).toBe(0);
      expect(results[0]!.records![2]!["src"]).toBe("origin");
    });
  });
});

// ── Operation integration tests (--lang python) ──────────────────

describe("Operations with --lang python", () => {
  describe("EvalOperation", () => {
    test("modifies records with Python snippet", () => {
      const collector = new LineCollector();
      const op = new EvalOperation(collector);
      op.init(["--lang", "python", "r['b'] = r['a'] + 1"]);

      op.acceptRecord(new Record({ a: 1 }));
      op.acceptRecord(new Record({ a: 5 }));
      op.finish();

      expect(collector.lines).toHaveLength(2);
      const r1 = JSON.parse(collector.lines[0]!);
      const r2 = JSON.parse(collector.lines[1]!);
      expect(r1.a).toBe(1);
      expect(r1.b).toBe(2);
      expect(r2.a).toBe(5);
      expect(r2.b).toBe(6);
    });
  });

  describe("GrepOperation", () => {
    test("filters records with Python expression", () => {
      const collector = new CollectorReceiver();
      const op = new GrepOperation(collector);
      op.init(["--lang", "python", "r['age'] > 25"]);

      op.acceptRecord(new Record({ name: "alice", age: 30 }));
      op.acceptRecord(new Record({ name: "bob", age: 20 }));
      op.acceptRecord(new Record({ name: "carol", age: 35 }));
      op.finish();

      expect(collector.records).toHaveLength(2);
      expect(collector.records[0]!.get("name")).toBe("alice");
      expect(collector.records[1]!.get("name")).toBe("carol");
    });

    test("supports -v (invert match) with Python", () => {
      const collector = new CollectorReceiver();
      const op = new GrepOperation(collector);
      op.init(["-v", "--lang", "python", "r['age'] > 25"]);

      op.acceptRecord(new Record({ name: "alice", age: 30 }));
      op.acceptRecord(new Record({ name: "bob", age: 20 }));
      op.finish();

      expect(collector.records).toHaveLength(1);
      expect(collector.records[0]!.get("name")).toBe("bob");
    });
  });

  describe("XformOperation", () => {
    test("transforms records with Python", () => {
      const collector = new CollectorReceiver();
      const op = new XformOperation(collector);
      op.init(["--lang", "python", "emit({'upper': r['name'].upper()})"]);

      op.acceptRecord(new Record({ name: "alice" }));
      op.acceptRecord(new Record({ name: "bob" }));
      op.finish();

      expect(collector.records).toHaveLength(2);
      expect(collector.records[0]!.get("upper")).toBe("ALICE");
      expect(collector.records[1]!.get("upper")).toBe("BOB");
    });

    test("emits multiple records per input", () => {
      const collector = new CollectorReceiver();
      const op = new XformOperation(collector);
      op.init([
        "--lang", "python",
        "for i in range(r['count']):\n    emit({'i': i})",
      ]);

      op.acceptRecord(new Record({ count: 3 }));
      op.finish();

      expect(collector.records).toHaveLength(3);
    });
  });

  describe("GenerateOperation", () => {
    test("generates records with Python and adds chain", () => {
      const collector = new CollectorReceiver();
      const op = new GenerateOperation(collector);
      op.init(["--lang", "python", "emit({'i': 1})\nemit({'i': 2})"]);

      op.acceptRecord(new Record({ src: "test" }));
      op.finish();

      expect(collector.records).toHaveLength(2);
      expect(collector.records[0]!.get("i")).toBe(1);
      // Check chain link
      expect(collector.records[0]!.get("_chain")).toEqual({ src: "test" });
    });
  });

  describe("AssertOperation", () => {
    test("passes when assertion is true", () => {
      const collector = new CollectorReceiver();
      const op = new AssertOperation(collector);
      op.init(["--lang", "python", "r['age'] > 0"]);

      op.acceptRecord(new Record({ age: 25 }));
      op.acceptRecord(new Record({ age: 10 }));
      op.finish();

      expect(collector.records).toHaveLength(2);
    });

    test("throws when assertion fails", () => {
      const collector = new CollectorReceiver();
      const op = new AssertOperation(collector);
      op.init(["--lang", "python", "r['age'] > 50"]);

      op.acceptRecord(new Record({ age: 25 }));

      expect(() => op.finish()).toThrow("Assertion failed");
    });
  });
});
