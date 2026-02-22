import { describe, test, expect } from "bun:test";
import { FromCsv } from "../../../src/operations/input/fromcsv.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromCsv(
  args: string[],
  content: string
): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromCsv(collector);
  op.init(args);
  op.parseContent(content);
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromCsv", () => {
  test("basic CSV with numeric keys", () => {
    const result = runFromCsv(
      [],
      "foo,bar,baz\n\"foo loo\",\"bar loo\", baz\n"
    );
    expect(result).toEqual([
      { "0": "foo", "1": "bar", "2": "baz" },
      { "0": "foo loo", "1": "bar loo", "2": "baz" },
    ]);
  });

  test("strict mode does not trim whitespace", () => {
    const result = runFromCsv(
      ["--strict"],
      "foo,bar,baz\n\"foo loo\",\"bar loo\", baz\n"
    );
    expect(result).toEqual([
      { "0": "foo", "1": "bar", "2": "baz" },
      { "0": "foo loo", "1": "bar loo", "2": " baz" },
    ]);
  });

  test("header mode reads first line as field names", () => {
    const result = runFromCsv(
      ["--header"],
      "one,two,three\nfoo,bar,baz\n\"foo loo\",\"bar loo\", baz\n"
    );
    expect(result).toEqual([
      { one: "foo", two: "bar", three: "baz" },
      { one: "foo loo", two: "bar loo", three: "baz" },
    ]);
  });

  test("key specs with nested paths", () => {
    const result = runFromCsv(
      ["--key", "zip/#0,zip/#1,zip/#2"],
      "foo,bar,baz\n\"foo loo\",\"bar loo\", baz\n"
    );
    expect(result[0]!["zip"]).toEqual(["foo", "bar", "baz"]);
    expect(result[1]!["zip"]).toEqual(["foo loo", "bar loo", "baz"]);
  });

  test("custom delimiter (semicolon)", () => {
    const result = runFromCsv(
      ["--delim", ";"],
      "foo;bar;baz\n\"foo loo\";\"bar loo\"; baz\n"
    );
    expect(result).toEqual([
      { "0": "foo", "1": "bar", "2": "baz" },
      { "0": "foo loo", "1": "bar loo", "2": "baz" },
    ]);
  });

  test("reads from file with header and static key", () => {
    const collector = new CollectorReceiver();
    const op = new FromCsv(collector);
    op.init([
      "--header",
      "--key",
      "static",
      "tests/fixtures/data3.csv",
      "tests/fixtures/data4.csv",
    ]);
    op.finish();
    const result = collector.records.map((r) => r.toJSON());
    expect(result).toEqual([
      { static: "42", foo: "bar", baz: "bat" },
      { static: "42", red: "green", yellow: "blue" },
    ]);
  });

  test("delimiter must be single character", () => {
    expect(() => {
      const op = new FromCsv();
      op.init(["--delim", "ab"]);
    }).toThrow("Delimiter must be a single character");
  });

  test("custom escape character", () => {
    const result = runFromCsv(
      ["--strict", "--escape", "\\"],
      '"foo \\"bar\\" bat"\n'
    );
    expect(result).toEqual([{ "0": 'foo "bar" bat' }]);
  });
});
