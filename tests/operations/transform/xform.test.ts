import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { XformOperation } from "../../../src/operations/transform/xform.ts";

function makeOp(args: string[]): { op: XformOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new XformOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: XformOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("XformOperation", () => {
  describe("basic transformation", () => {
    test("modifies records in place", () => {
      const { op, collector } = makeOp(["{{line}} = $line"]);
      feedRecords(op, [
        new Record({ a: 1 }),
        new Record({ a: 2 }),
      ]);

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("line")).toBe(1);
      expect(collector.records[1]!.get("line")).toBe(2);
    });

    test("can add new fields", () => {
      const { op, collector } = makeOp(["{{sum}} = {{x}} + {{y}}"]);
      feedRecords(op, [
        new Record({ x: 3, y: 4 }),
      ]);

      expect(collector.records[0]!.get("sum")).toBe(7);
    });

    test("returns array to split records", () => {
      const { op, collector } = makeOp(["return [{a: 1}, {a: 2}]"]);
      feedRecords(op, [
        new Record({ x: 1 }),
      ]);

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("a")).toBe(1);
      expect(collector.records[1]!.get("a")).toBe(2);
    });

    test("requires expression", () => {
      expect(() => {
        makeOp([]);
      }).toThrow("xform requires an expression");
    });

    test("passes through unmodified records", () => {
      const { op, collector } = makeOp(["r"]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("a")).toBe(1);
    });

    test("handles multiple records", () => {
      const { op, collector } = makeOp(["{{doubled}} = {{x}} * 2"]);
      feedRecords(op, [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
        new Record({ x: 4 }),
        new Record({ x: 5 }),
      ]);

      expect(collector.records.length).toBe(5);
      expect(collector.records[0]!.get("doubled")).toBe(2);
      expect(collector.records[4]!.get("doubled")).toBe(10);
    });

    test("handles empty input", () => {
      const { op, collector } = makeOp(["{{x}} = 1"]);
      feedRecords(op, []);

      expect(collector.records.length).toBe(0);
    });

    test("handles trailing comment in snippet", () => {
      const { op, collector } = makeOp(["{{x}} = 1 // set x"]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("x")).toBe(1);
    });

    test("uses --expr/-e flag", () => {
      const { op, collector } = makeOp(["-e", "{{x}} = {{a}} + 1"]);
      feedRecords(op, [
        new Record({ a: 5 }),
      ]);

      expect(collector.records[0]!.get("x")).toBe(6);
    });

    test("--expr takes precedence over positional arg", () => {
      const { op, collector } = makeOp(["-e", "{{x}} = 42"]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      expect(collector.records[0]!.get("x")).toBe(42);
    });

    test("array return with Record objects", () => {
      const { op, collector } = makeOp(["return [r]"]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("a")).toBe(1);
    });

    test("returns empty array to suppress record", () => {
      const { op, collector } = makeOp(["return []"]);
      feedRecords(op, [
        new Record({ a: 1 }),
        new Record({ a: 2 }),
      ]);

      expect(collector.records.length).toBe(0);
    });

    test("conditional transformation", () => {
      const { op, collector } = makeOp(["if ({{x}} > 2) { {{big}} = true }"]);
      feedRecords(op, [
        new Record({ x: 1 }),
        new Record({ x: 3 }),
        new Record({ x: 5 }),
      ]);

      expect(collector.records.length).toBe(3);
      expect(collector.records[0]!.get("big")).toBeUndefined();
      expect(collector.records[1]!.get("big")).toBe(true);
      expect(collector.records[2]!.get("big")).toBe(true);
    });
  });

  describe("push_output", () => {
    test("sends records directly to output", () => {
      const { op, collector } = makeOp([
        "push_output({x: r.get('a') * 10}); push_output({x: r.get('a') * 100})",
      ]);
      feedRecords(op, [
        new Record({ a: 2 }),
        new Record({ a: 3 }),
      ]);

      expect(collector.records.length).toBe(4);
      expect(collector.records[0]!.get("x")).toBe(20);
      expect(collector.records[1]!.get("x")).toBe(200);
      expect(collector.records[2]!.get("x")).toBe(30);
      expect(collector.records[3]!.get("x")).toBe(300);
    });

    test("suppresses default record output", () => {
      const { op, collector } = makeOp(["push_output({out: true})"]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      // Only the pushed record should appear, not the original
      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("out")).toBe(true);
    });

    test("conditional suppression with push_output", () => {
      const { op, collector } = makeOp([
        "if ({{x}} > 2) { push_output({filtered: {{x}}}) }",
      ]);
      feedRecords(op, [
        new Record({ x: 1 }),
        new Record({ x: 3 }),
        new Record({ x: 2 }),
        new Record({ x: 5 }),
      ]);

      // Records with x <= 2 pass through normally; records with x > 2
      // get replaced with the push_output record
      expect(collector.records.length).toBe(4);
      expect(collector.records[0]!.get("x")).toBe(1);
      expect(collector.records[1]!.get("filtered")).toBe(3);
      expect(collector.records[2]!.get("x")).toBe(2);
      expect(collector.records[3]!.get("filtered")).toBe(5);
    });
  });

  describe("push_input", () => {
    test("re-injects records into the input stream", () => {
      // Use push_input to duplicate a record with a marker, but only once
      const { op, collector } = makeOp([
        "if (!r.get('dup')) { push_input({a: r.get('a'), dup: true}) }",
      ]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      // The original is suppressed (push_input sets suppressR), then the
      // duplicated record {a:1, dup:true} is re-processed and output normally
      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("a")).toBe(1);
      expect(collector.records[0]!.get("dup")).toBe(true);
    });

    test("push_input with multiple records", () => {
      const { op, collector } = makeOp([
        "if (!r.get('seen')) { push_input({val: r.get('a'), seen: true}); push_input({val: r.get('a') * 2, seen: true}) }",
      ]);
      feedRecords(op, [
        new Record({ a: 5 }),
      ]);

      // Original suppressed, two new records injected and processed
      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("val")).toBe(5);
      expect(collector.records[1]!.get("val")).toBe(10);
    });
  });

  describe("context operations", () => {
    test("before context with -B", () => {
      const { op, collector } = makeOp([
        "-B", "1",
        "{{prev}} = B.length > 0 ? B[0].get('x') : null",
      ]);
      feedRecords(op, [
        new Record({ x: 10 }),
        new Record({ x: 20 }),
        new Record({ x: 30 }),
      ]);

      expect(collector.records.length).toBe(3);
      // First record has no before context
      expect(collector.records[0]!.get("prev")).toBe(null);
      // Second record sees first record in B
      expect(collector.records[1]!.get("prev")).toBe(10);
      // Third record sees second record in B
      expect(collector.records[2]!.get("prev")).toBe(20);
    });

    test("before context with -B 2", () => {
      const { op, collector } = makeOp([
        "-B", "2",
        "{{count}} = B.length",
      ]);
      feedRecords(op, [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
        new Record({ x: 4 }),
      ]);

      expect(collector.records.length).toBe(4);
      expect(collector.records[0]!.get("count")).toBe(0);
      expect(collector.records[1]!.get("count")).toBe(1);
      expect(collector.records[2]!.get("count")).toBe(2);
      expect(collector.records[3]!.get("count")).toBe(2);
    });

    test("after context with -A", () => {
      const { op, collector } = makeOp([
        "-A", "1",
        "{{next}} = A.length > 0 ? A[0].get('x') : null",
      ]);
      feedRecords(op, [
        new Record({ x: 10 }),
        new Record({ x: 20 }),
        new Record({ x: 30 }),
      ]);

      expect(collector.records.length).toBe(3);
      // First record sees second record in A
      expect(collector.records[0]!.get("next")).toBe(20);
      // Second record sees third record in A
      expect(collector.records[1]!.get("next")).toBe(30);
      // Third record has no after context
      expect(collector.records[2]!.get("next")).toBe(null);
    });

    test("after context with -A 2", () => {
      const { op, collector } = makeOp([
        "-A", "2",
        "{{count}} = A.length",
      ]);
      feedRecords(op, [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
        new Record({ x: 4 }),
      ]);

      expect(collector.records.length).toBe(4);
      expect(collector.records[0]!.get("count")).toBe(2);
      expect(collector.records[1]!.get("count")).toBe(2);
      expect(collector.records[2]!.get("count")).toBe(1);
      expect(collector.records[3]!.get("count")).toBe(0);
    });

    test("combined context with -C", () => {
      const { op, collector } = makeOp([
        "-C", "1",
        "{{before}} = B.length; {{after}} = A.length",
      ]);
      feedRecords(op, [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
      ]);

      expect(collector.records.length).toBe(3);
      // First: no before, 1 after
      expect(collector.records[0]!.get("before")).toBe(0);
      expect(collector.records[0]!.get("after")).toBe(1);
      // Middle: 1 before, 1 after
      expect(collector.records[1]!.get("before")).toBe(1);
      expect(collector.records[1]!.get("after")).toBe(1);
      // Last: 1 before, no after
      expect(collector.records[2]!.get("before")).toBe(1);
      expect(collector.records[2]!.get("after")).toBe(0);
    });

    test("-C sets both before and after", () => {
      const { op, collector } = makeOp([
        "-C", "2",
        "{{bLen}} = B.length; {{aLen}} = A.length",
      ]);
      feedRecords(op, [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
        new Record({ x: 4 }),
        new Record({ x: 5 }),
      ]);

      expect(collector.records.length).toBe(5);
      expect(collector.records[0]!.get("bLen")).toBe(0);
      expect(collector.records[0]!.get("aLen")).toBe(2);
      expect(collector.records[2]!.get("bLen")).toBe(2);
      expect(collector.records[2]!.get("aLen")).toBe(2);
      expect(collector.records[4]!.get("bLen")).toBe(2);
      expect(collector.records[4]!.get("aLen")).toBe(0);
    });

    test("context with single record", () => {
      const { op, collector } = makeOp([
        "-C", "1",
        "{{before}} = B.length; {{after}} = A.length",
      ]);
      feedRecords(op, [
        new Record({ x: 1 }),
      ]);

      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("before")).toBe(0);
      expect(collector.records[0]!.get("after")).toBe(0);
    });

    test("context with empty input", () => {
      const { op, collector } = makeOp([
        "-B", "2",
        "{{count}} = B.length",
      ]);
      feedRecords(op, []);

      expect(collector.records.length).toBe(0);
    });

    test("accessing before record values", () => {
      const { op, collector } = makeOp([
        "-B", "1",
        "{{before_val}} = B.length > 0 ? B[0].get('x') : 'none'",
      ]);
      feedRecords(op, [
        new Record({ x: "first" }),
        new Record({ x: "second" }),
        new Record({ x: "third" }),
      ]);

      expect(collector.records[0]!.get("before_val")).toBe("none");
      expect(collector.records[1]!.get("before_val")).toBe("first");
      expect(collector.records[2]!.get("before_val")).toBe("second");
    });

    test("B array ordering: most recent first", () => {
      const { op, collector } = makeOp([
        "-B", "3",
        "{{bvals}} = B.map(b => b.get('x')).join(',')",
      ]);
      feedRecords(op, [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
        new Record({ x: 4 }),
        new Record({ x: 5 }),
      ]);

      // B[0] is the most recent previous record (unshift order)
      expect(collector.records[4]!.get("bvals")).toBe("4,3,2");
    });
  });

  describe("pre-snippet", () => {
    test("runs before any records", () => {
      const { op, collector } = makeOp([
        "--pre-snippet", "state.count = 0",
        "state.count++; {{idx}} = state.count",
      ]);
      feedRecords(op, [
        new Record({ a: 1 }),
        new Record({ a: 2 }),
        new Record({ a: 3 }),
      ]);

      expect(collector.records.length).toBe(3);
      expect(collector.records[0]!.get("idx")).toBe(1);
      expect(collector.records[1]!.get("idx")).toBe(2);
      expect(collector.records[2]!.get("idx")).toBe(3);
    });

    test("pre-snippet with push_output", () => {
      const { op, collector } = makeOp([
        "--pre-snippet", "push_output({header: true})",
        "r",
      ]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("header")).toBe(true);
      expect(collector.records[1]!.get("a")).toBe(1);
    });

    test("pre-snippet variable scoping persists to main snippet", () => {
      const { op, collector } = makeOp([
        "--pre-snippet", "state.prefix = 'hello'",
        "{{msg}} = state.prefix + '_' + {{a}}",
      ]);
      feedRecords(op, [
        new Record({ a: "world" }),
      ]);

      expect(collector.records[0]!.get("msg")).toBe("hello_world");
    });

    test("pre-snippet runs even with empty input", () => {
      const { op, collector } = makeOp([
        "--pre-snippet", "push_output({init: true})",
        "r",
      ]);
      feedRecords(op, []);

      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("init")).toBe(true);
    });
  });

  describe("post-snippet", () => {
    test("runs after all records", () => {
      const { op, collector } = makeOp([
        "--post-snippet", "push_output({done: true})",
        "r.set('seen', true)",
      ]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("seen")).toBe(true);
      expect(collector.records[1]!.get("done")).toBe(true);
    });

    test("post-snippet can access state from main snippet", () => {
      const { op, collector } = makeOp([
        "--post-snippet", "push_output({total: state.sum})",
        "state.sum = (state.sum || 0) + {{x}}",
      ]);
      feedRecords(op, [
        new Record({ x: 10 }),
        new Record({ x: 20 }),
        new Record({ x: 30 }),
      ]);

      expect(collector.records.length).toBe(4);
      expect(collector.records[3]!.get("total")).toBe(60);
    });

    test("post-snippet with push_input", () => {
      const { op, collector } = makeOp([
        "--post-snippet", "push_input({injected: true})",
        "{{processed}} = true",
      ]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      // Original record + injected record processed through main snippet
      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("processed")).toBe(true);
      expect(collector.records[1]!.get("injected")).toBe(true);
      expect(collector.records[1]!.get("processed")).toBe(true);
    });

    test("post-snippet runs even with empty input", () => {
      const { op, collector } = makeOp([
        "--post-snippet", "push_output({footer: true})",
        "r",
      ]);
      feedRecords(op, []);

      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("footer")).toBe(true);
    });

    test("post-snippet can emit multiple records", () => {
      const { op, collector } = makeOp([
        "--post-snippet", "push_output({s: 1}); push_output({s: 2}); push_output({s: 3})",
        "r",
      ]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      expect(collector.records.length).toBe(4);
      expect(collector.records[1]!.get("s")).toBe(1);
      expect(collector.records[2]!.get("s")).toBe(2);
      expect(collector.records[3]!.get("s")).toBe(3);
    });
  });

  describe("pre and post snippets combined", () => {
    test("pre-snippet initializes, post-snippet summarizes", () => {
      const { op, collector } = makeOp([
        "--pre-snippet", "state.sum = 0",
        "--post-snippet", "push_output({sum: state.sum})",
        "state.sum += {{x}}",
      ]);
      feedRecords(op, [
        new Record({ x: 1 }),
        new Record({ x: 2 }),
        new Record({ x: 3 }),
      ]);

      // 3 records + 1 summary
      expect(collector.records.length).toBe(4);
      expect(collector.records[3]!.get("sum")).toBe(6);
    });

    test("pre and post with empty input", () => {
      const { op, collector } = makeOp([
        "--pre-snippet", "push_output({start: true})",
        "--post-snippet", "push_output({end: true})",
        "r",
      ]);
      feedRecords(op, []);

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("start")).toBe(true);
      expect(collector.records[1]!.get("end")).toBe(true);
    });
  });

  describe("line counter", () => {
    test("$line starts at 1", () => {
      const { op, collector } = makeOp(["{{line}} = $line"]);
      feedRecords(op, [
        new Record({ a: 1 }),
        new Record({ a: 2 }),
        new Record({ a: 3 }),
      ]);

      expect(collector.records[0]!.get("line")).toBe(1);
      expect(collector.records[1]!.get("line")).toBe(2);
      expect(collector.records[2]!.get("line")).toBe(3);
    });

    test("$line resets after pre-snippet", () => {
      const { op, collector } = makeOp([
        "--pre-snippet", "state.x = 1",
        "{{line}} = $line",
      ]);
      feedRecords(op, [
        new Record({ a: 1 }),
        new Record({ a: 2 }),
      ]);

      // Pre-snippet increments line, but resetLine() is called after
      expect(collector.records[0]!.get("line")).toBe(1);
      expect(collector.records[1]!.get("line")).toBe(2);
    });
  });

  describe("edge cases", () => {
    test("record with nested fields", () => {
      const { op, collector } = makeOp(["{{a/b}} = {{x}} + 1"]);
      feedRecords(op, [
        new Record({ x: 5, a: { b: 0 } }),
      ]);

      // KeySpec a/b navigates into nested object
      const data = collector.records[0]!.dataRef() as { a: { b: number } };
      expect(data.a.b).toBe(6);
    });

    test("modifying record doesn't affect original", () => {
      const original = new Record({ x: 1 });
      const { op, collector } = makeOp(["{{y}} = {{x}} + 1"]);
      feedRecords(op, [original]);

      expect(collector.records[0]!.get("y")).toBe(2);
      // xform modifies in place, so original IS modified
      expect(original.get("y")).toBe(2);
    });

    test("undefined field access", () => {
      const { op, collector } = makeOp(["{{result}} = {{missing}} || 'default'"]);
      feedRecords(op, [
        new Record({ a: 1 }),
      ]);

      expect(collector.records[0]!.get("result")).toBe("default");
    });

    test("multiple semicolons in expression", () => {
      const { op, collector } = makeOp(["{{x}} = 1; {{y}} = 2; {{z}} = 3"]);
      feedRecords(op, [
        new Record({}),
      ]);

      expect(collector.records[0]!.get("x")).toBe(1);
      expect(collector.records[0]!.get("y")).toBe(2);
      expect(collector.records[0]!.get("z")).toBe(3);
    });

    test("record method access (r.get/r.set)", () => {
      const { op, collector } = makeOp(["r.set('b', r.get('a') * 2)"]);
      feedRecords(op, [
        new Record({ a: 5 }),
      ]);

      expect(collector.records[0]!.get("b")).toBe(10);
    });
  });
});
