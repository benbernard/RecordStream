import { describe, test, expect } from "bun:test";
import { FromJsonArray } from "../../../src/operations/input/fromjsonarray.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromJsonArray(
  args: string[],
  content: string
): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromJsonArray(collector);
  op.init(args);
  op.parseContent(content);
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromJsonArray", () => {
  const input1 = '[{"a": 1, "foo": "bar"},{"b": 2, "a": 2},{"c": 3},{"b": 4}]';
  const input2 = `[
    {
      "a": 1,
      "foo": "bar"
    },
    {"b": 2, "a": 2},
    {"c": 3},
    {"b": 4}
  ]`;

  test("basic JSON array parsing (compact)", () => {
    const result = runFromJsonArray([], input1);
    expect(result).toEqual([
      { a: 1, foo: "bar" },
      { a: 2, b: 2 },
      { c: 3 },
      { b: 4 },
    ]);
  });

  test("basic JSON array parsing (pretty printed)", () => {
    const result = runFromJsonArray([], input2);
    expect(result).toEqual([
      { a: 1, foo: "bar" },
      { a: 2, b: 2 },
      { c: 3 },
      { b: 4 },
    ]);
  });

  test("extract specific key", () => {
    const result = runFromJsonArray(["--key", "a"], input1);
    expect(result).toEqual([
      { a: 1 },
      { a: 2 },
      { a: null },
      { a: null },
    ]);
  });

  test("extract multiple keys", () => {
    const result = runFromJsonArray(["--key", "a,b"], input1);
    expect(result).toEqual([
      { a: 1, b: null },
      { a: 2, b: 2 },
      { a: null, b: null },
      { a: null, b: 4 },
    ]);
  });

  test("nested key specs", () => {
    const input = `[{"a": [1, 2], "b": {"foo": "bar1", "baz": "biz1"}, "c": 0},
{"a": [3, 4], "b": {"foo": "bar2", "baz": "biz2"}, "c": 2},
{"c": 4, "a": ["foo", "baz"]},
{"d": 4}]`;

    const result = runFromJsonArray(["--key", "a/#1", "--key", "b/foo"], input);
    expect(result).toEqual([
      { "a/#1": 2, "b/foo": "bar1" },
      { "a/#1": 4, "b/foo": "bar2" },
      { "a/#1": "baz", "b/foo": null },
      { "a/#1": null, "b/foo": null },
    ]);
  });
});
