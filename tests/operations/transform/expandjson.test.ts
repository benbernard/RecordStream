import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { ExpandJsonOperation } from "../../../src/operations/transform/expandjson.ts";

function makeOp(args: string[]): { op: ExpandJsonOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new ExpandJsonOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("ExpandJsonOperation", () => {
  test("expands a single key containing a JSON object string", () => {
    const { op, collector } = makeOp(["--key", "metadata"]);
    op.acceptRecord(new Record({
      name: "alice",
      metadata: '{"role":"admin","level":3}',
    }));
    op.finish();

    expect(collector.records.length).toBe(1);
    const r = collector.records[0]!;
    expect(r.get("name")).toBe("alice");
    expect(r.get("metadata")).toEqual({ role: "admin", level: 3 });
  });

  test("expands a key containing a JSON array string", () => {
    const { op, collector } = makeOp(["--key", "tags"]);
    op.acceptRecord(new Record({
      tags: '["a","b","c"]',
    }));
    op.finish();

    expect(collector.records[0]!.get("tags")).toEqual(["a", "b", "c"]);
  });

  test("expands multiple specified keys", () => {
    const { op, collector } = makeOp(["--key", "a", "--key", "b"]);
    op.acceptRecord(new Record({
      a: '{"x":1}',
      b: '["y"]',
      c: "not json",
    }));
    op.finish();

    const r = collector.records[0]!;
    expect(r.get("a")).toEqual({ x: 1 });
    expect(r.get("b")).toEqual(["y"]);
    expect(r.get("c")).toBe("not json");
  });

  test("auto-detects and expands all JSON-like string fields when no --key specified", () => {
    const { op, collector } = makeOp([]);
    op.acceptRecord(new Record({
      obj: '{"k":"v"}',
      arr: '[1,2,3]',
      plain: "hello",
      num: 42,
    }));
    op.finish();

    const r = collector.records[0]!;
    expect(r.get("obj")).toEqual({ k: "v" });
    expect(r.get("arr")).toEqual([1, 2, 3]);
    expect(r.get("plain")).toBe("hello");
    expect(r.get("num")).toBe(42);
  });

  test("recursively expands nested JSON strings with -r", () => {
    const { op, collector } = makeOp(["-r", "--key", "data"]);
    const inner = JSON.stringify({ z: 99 });
    const outer = JSON.stringify({ nested: inner });
    op.acceptRecord(new Record({ data: outer }));
    op.finish();

    const r = collector.records[0]!;
    expect(r.get("data")).toEqual({ nested: { z: 99 } });
  });

  test("leaves non-JSON strings alone", () => {
    const { op, collector } = makeOp(["--key", "name"]);
    op.acceptRecord(new Record({ name: "just a string" }));
    op.finish();

    expect(collector.records[0]!.get("name")).toBe("just a string");
  });

  test("leaves non-string values alone", () => {
    const { op, collector } = makeOp(["--key", "count"]);
    op.acceptRecord(new Record({ count: 42 }));
    op.finish();

    expect(collector.records[0]!.get("count")).toBe(42);
  });

  test("leaves malformed JSON strings alone", () => {
    const { op, collector } = makeOp(["--key", "bad"]);
    op.acceptRecord(new Record({ bad: "{not valid json" }));
    op.finish();

    expect(collector.records[0]!.get("bad")).toBe("{not valid json");
  });

  test("deep recursive: JSON within JSON within JSON", () => {
    const { op, collector } = makeOp(["-r", "--key", "data"]);
    const innermost = JSON.stringify({ deep: true });
    const middle = JSON.stringify({ level2: innermost });
    const outer = JSON.stringify({ level1: middle });
    op.acceptRecord(new Record({ data: outer }));
    op.finish();

    const r = collector.records[0]!;
    expect(r.get("data")).toEqual({
      level1: {
        level2: {
          deep: true,
        },
      },
    });
  });

  test("handles empty object string", () => {
    const { op, collector } = makeOp(["--key", "x"]);
    op.acceptRecord(new Record({ x: "{}" }));
    op.finish();

    expect(collector.records[0]!.get("x")).toEqual({});
  });

  test("handles empty array string", () => {
    const { op, collector } = makeOp(["--key", "x"]);
    op.acceptRecord(new Record({ x: "[]" }));
    op.finish();

    expect(collector.records[0]!.get("x")).toEqual([]);
  });

  test("handles 'null' string", () => {
    const { op, collector } = makeOp(["--key", "x"]);
    op.acceptRecord(new Record({ x: "null" }));
    op.finish();

    expect(collector.records[0]!.get("x")).toBeNull();
  });

  test("handles 'true' string", () => {
    const { op, collector } = makeOp(["--key", "x"]);
    op.acceptRecord(new Record({ x: "true" }));
    op.finish();

    expect(collector.records[0]!.get("x")).toBe(true);
  });

  test("handles 'false' string", () => {
    const { op, collector } = makeOp(["--key", "x"]);
    op.acceptRecord(new Record({ x: "false" }));
    op.finish();

    expect(collector.records[0]!.get("x")).toBe(false);
  });

  test("recursive expands arrays containing JSON strings", () => {
    const { op, collector } = makeOp(["-r", "--key", "items"]);
    op.acceptRecord(new Record({
      items: JSON.stringify(["plain", '{"a":1}']),
    }));
    op.finish();

    const r = collector.records[0]!;
    expect(r.get("items")).toEqual(["plain", { a: 1 }]);
  });

  test("recursive auto-detect mode expands all fields", () => {
    const { op, collector } = makeOp(["-r"]);
    const inner = JSON.stringify({ v: 1 });
    const outer = JSON.stringify({ inner });
    op.acceptRecord(new Record({
      data: outer,
      plain: "hello",
    }));
    op.finish();

    const r = collector.records[0]!;
    expect(r.get("data")).toEqual({ inner: { v: 1 } });
    expect(r.get("plain")).toBe("hello");
  });

  test("handles multiple records", () => {
    const { op, collector } = makeOp(["--key", "data"]);
    op.acceptRecord(new Record({ data: '{"a":1}' }));
    op.acceptRecord(new Record({ data: '{"b":2}' }));
    op.acceptRecord(new Record({ data: "not json" }));
    op.finish();

    expect(collector.records.length).toBe(3);
    expect(collector.records[0]!.get("data")).toEqual({ a: 1 });
    expect(collector.records[1]!.get("data")).toEqual({ b: 2 });
    expect(collector.records[2]!.get("data")).toBe("not json");
  });

  test("works with nested keyspecs", () => {
    const { op, collector } = makeOp(["--key", "a/b"]);
    op.acceptRecord(new Record({ a: { b: '{"c":3}' } }));
    op.finish();

    const r = collector.records[0]!;
    const a = r.get("a") as { b: { c: number } };
    expect(a.b).toEqual({ c: 3 });
  });

  test("whitespace-padded JSON strings are expanded", () => {
    const { op, collector } = makeOp(["--key", "x"]);
    op.acceptRecord(new Record({ x: '  {"a":1}  ' }));
    op.finish();

    expect(collector.records[0]!.get("x")).toEqual({ a: 1 });
  });
});
