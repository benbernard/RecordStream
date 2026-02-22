import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";
import { PerlSnippetRunner } from "../../src/snippets/PerlSnippetRunner.ts";
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

// ── Direct PerlSnippetRunner tests ───────────────────────────────

describe("PerlSnippetRunner (direct)", () => {
  describe("eval mode", () => {
    test("modifies record in place", () => {
      const runner = new PerlSnippetRunner();
      void runner.init('$r->{age} = $r->{age} + 1', { mode: "eval" });

      const results = runner.executeBatch([
        new Record({ name: "alice", age: 30 }),
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]!.record!["name"]).toBe("alice");
      expect(results[0]!.record!["age"]).toBe(31);
    });

    test("handles multiple records", () => {
      const runner = new PerlSnippetRunner();
      void runner.init('$r->{x} = $r->{x} * 2', { mode: "eval" });

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
      const runner = new PerlSnippetRunner();
      void runner.init('$r->{age} > 25', { mode: "grep" });

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

    test("string equality", () => {
      const runner = new PerlSnippetRunner();
      void runner.init('$r->{status} eq "active"', { mode: "grep" });

      const results = runner.executeBatch([
        new Record({ status: "active" }),
        new Record({ status: "inactive" }),
      ]);

      expect(results[0]!.passed).toBe(true);
      expect(results[1]!.passed).toBe(false);
    });
  });

  describe("xform mode", () => {
    test("push_record emits records", () => {
      const runner = new PerlSnippetRunner();
      void runner.init(
        'push_record({ x => $r->{x} * 2 }); push_record({ x => $r->{x} * 3 })',
        { mode: "xform" }
      );

      const results = runner.executeBatch([new Record({ x: 10 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.records).toHaveLength(2);
      expect(results[0]!.records![0]!["x"]).toBe(20);
      expect(results[0]!.records![1]!["x"]).toBe(30);
    });
  });

  describe("generate mode", () => {
    test("push_record emits new records", () => {
      const runner = new PerlSnippetRunner();
      void runner.init(
        'for my $i (1..3) { push_record({ idx => $i, src => $r->{name} }) }',
        { mode: "generate" }
      );

      const results = runner.executeBatch([new Record({ name: "alice" })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.records).toHaveLength(3);
      expect(results[0]!.records![0]!["idx"]).toBe(1);
      expect(results[0]!.records![0]!["src"]).toBe("alice");
    });
  });
});

// ── Operation integration tests (--lang perl) ────────────────────

describe("Operations with --lang perl", () => {
  describe("EvalOperation", () => {
    test("modifies records with Perl snippet", () => {
      const collector = new LineCollector();
      const op = new EvalOperation(collector);
      op.init(["--lang", "perl", '$r->{b} = $r->{a} + 1']);

      op.acceptRecord(new Record({ a: 1 }));
      op.acceptRecord(new Record({ a: 5 }));
      op.finish();

      expect(collector.lines).toHaveLength(2);
      const r1 = JSON.parse(collector.lines[0]!);
      const r2 = JSON.parse(collector.lines[1]!);
      expect(r1.b).toBe(2);
      expect(r2.b).toBe(6);
    });
  });

  describe("GrepOperation", () => {
    test("filters records with Perl expression", () => {
      const collector = new CollectorReceiver();
      const op = new GrepOperation(collector);
      op.init(["--lang", "perl", '$r->{age} > 25']);

      op.acceptRecord(new Record({ name: "alice", age: 30 }));
      op.acceptRecord(new Record({ name: "bob", age: 20 }));
      op.acceptRecord(new Record({ name: "carol", age: 35 }));
      op.finish();

      expect(collector.records).toHaveLength(2);
      expect(collector.records[0]!.get("name")).toBe("alice");
      expect(collector.records[1]!.get("name")).toBe("carol");
    });

    test("supports -v (invert match) with Perl", () => {
      const collector = new CollectorReceiver();
      const op = new GrepOperation(collector);
      op.init(["-v", "--lang", "perl", '$r->{age} > 25']);

      op.acceptRecord(new Record({ name: "alice", age: 30 }));
      op.acceptRecord(new Record({ name: "bob", age: 20 }));
      op.finish();

      expect(collector.records).toHaveLength(1);
      expect(collector.records[0]!.get("name")).toBe("bob");
    });
  });

  describe("XformOperation", () => {
    test("transforms records with Perl", () => {
      const collector = new CollectorReceiver();
      const op = new XformOperation(collector);
      op.init(["--lang", "perl", '$r->{upper} = uc($r->{name})']);

      op.acceptRecord(new Record({ name: "alice" }));
      op.finish();

      expect(collector.records).toHaveLength(1);
      expect(collector.records[0]!.get("upper")).toBe("ALICE");
    });

    test("push_record emits multiple records", () => {
      const collector = new CollectorReceiver();
      const op = new XformOperation(collector);
      op.init([
        "--lang", "perl",
        'push_record({ x => $r->{x} * 2 }); push_record({ x => $r->{x} * 3 })',
      ]);

      op.acceptRecord(new Record({ x: 10 }));
      op.finish();

      expect(collector.records).toHaveLength(2);
      expect(collector.records[0]!.get("x")).toBe(20);
      expect(collector.records[1]!.get("x")).toBe(30);
    });
  });

  describe("GenerateOperation", () => {
    test("generates records with Perl and adds chain", () => {
      const collector = new CollectorReceiver();
      const op = new GenerateOperation(collector);
      op.init([
        "--lang", "perl",
        'for my $i (1..2) { push_record({ idx => $i }) }',
      ]);

      op.acceptRecord(new Record({ src: "test" }));
      op.finish();

      expect(collector.records).toHaveLength(2);
      expect(collector.records[0]!.get("idx")).toBe(1);
      expect(collector.records[0]!.get("_chain")).toEqual({ src: "test" });
    });
  });

  describe("AssertOperation", () => {
    test("passes when assertion is true", () => {
      const collector = new CollectorReceiver();
      const op = new AssertOperation(collector);
      op.init(["--lang", "perl", '$r->{age} > 0']);

      op.acceptRecord(new Record({ age: 25 }));
      op.finish();

      expect(collector.records).toHaveLength(1);
    });

    test("throws when assertion fails", () => {
      const collector = new CollectorReceiver();
      const op = new AssertOperation(collector);
      op.init(["--lang", "perl", '$r->{age} > 50']);

      op.acceptRecord(new Record({ age: 25 }));

      expect(() => op.finish()).toThrow("Assertion failed");
    });
  });
});

// ── Cross-language tests ─────────────────────────────────────────

describe("Cross-language --lang flag", () => {
  test("eval with --lang js uses JS executor (default behavior)", () => {
    const collector = new LineCollector();
    const op = new EvalOperation(collector);
    op.init(["--lang", "js", "return {{a}} + 1"]);

    op.acceptRecord(new Record({ a: 5 }));
    op.finish();

    expect(collector.lines).toHaveLength(1);
    expect(collector.lines[0]).toBe("6");
  });

  test("grep with all 3 languages", () => {
    // JS
    const jsCollector = new CollectorReceiver();
    const jsOp = new GrepOperation(jsCollector);
    jsOp.init(["r.get('x') > 5"]);
    jsOp.acceptRecord(new Record({ x: 10 }));
    jsOp.acceptRecord(new Record({ x: 3 }));
    jsOp.finish();
    expect(jsCollector.records).toHaveLength(1);

    // Python
    const pyCollector = new CollectorReceiver();
    const pyOp = new GrepOperation(pyCollector);
    pyOp.init(["--lang", "python", "r['x'] > 5"]);
    pyOp.acceptRecord(new Record({ x: 10 }));
    pyOp.acceptRecord(new Record({ x: 3 }));
    pyOp.finish();
    expect(pyCollector.records).toHaveLength(1);

    // Perl
    const plCollector = new CollectorReceiver();
    const plOp = new GrepOperation(plCollector);
    plOp.init(["--lang", "perl", '$r->{x} > 5']);
    plOp.acceptRecord(new Record({ x: 10 }));
    plOp.acceptRecord(new Record({ x: 3 }));
    plOp.finish();
    expect(plCollector.records).toHaveLength(1);
  });

  test("xform with all 3 languages", () => {
    // JS
    const jsCollector = new CollectorReceiver();
    const jsOp = new XformOperation(jsCollector);
    jsOp.init(["r.set('doubled', r.get('x') * 2)"]);
    jsOp.acceptRecord(new Record({ x: 5 }));
    jsOp.finish();
    expect(jsCollector.records[0]!.get("doubled")).toBe(10);

    // Python
    const pyCollector = new CollectorReceiver();
    const pyOp = new XformOperation(pyCollector);
    pyOp.init(["--lang", "python", "r['doubled'] = r['x'] * 2\nemit(r.to_dict())"]);
    pyOp.acceptRecord(new Record({ x: 5 }));
    pyOp.finish();
    expect(pyCollector.records[0]!.get("doubled")).toBe(10);

    // Perl
    const plCollector = new CollectorReceiver();
    const plOp = new XformOperation(plCollector);
    plOp.init(["--lang", "perl", '$r->{doubled} = $r->{x} * 2']);
    plOp.acceptRecord(new Record({ x: 5 }));
    plOp.finish();
    expect(plCollector.records[0]!.get("doubled")).toBe(10);
  });
});
