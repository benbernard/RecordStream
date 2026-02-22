import { describe, test, expect } from "bun:test";
import { FromSplit } from "../../../src/operations/input/fromsplit.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromSplit(
  args: string[],
  lines: string[]
): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromSplit(collector);
  op.init(args);
  for (const line of lines) {
    op.processLine(line);
  }
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromSplit", () => {
  test("split file with custom delimiter and field name", () => {
    const collector = new CollectorReceiver();
    const op = new FromSplit(collector);
    op.init(["-f", "f1", "-d", " ", "tests/fixtures/splitfile"]);
    op.finish();
    const result = collector.records.map((r) => r.toJSON());
    expect(result).toEqual([
      { f1: "A1", "1": "A2,2", "2": "A3" },
      { f1: "B1", "1": "B2", "2": "B3,B4", "3": "B5" },
    ]);
  });

  test("split file with default delimiter (comma regex)", () => {
    const collector = new CollectorReceiver();
    const op = new FromSplit(collector);
    op.init(["tests/fixtures/splitfile"]);
    op.finish();
    const result = collector.records.map((r) => r.toJSON());
    expect(result).toEqual([
      { "0": "A1 A2", "1": "2 A3" },
      { "0": "B1 B2 B3", "1": "B4 B5" },
    ]);
  });

  test("split file with header", () => {
    const collector = new CollectorReceiver();
    const op = new FromSplit(collector);
    op.init(["--header", "tests/fixtures/splitfile"]);
    op.finish();
    const result = collector.records.map((r) => r.toJSON());
    expect(result).toEqual([
      { "A1 A2": "B1 B2 B3", "2 A3": "B4 B5" },
    ]);
  });

  test("strict mode splits literally", () => {
    const result = runFromSplit(
      ["--strict", "--delim", " "],
      ["foo bar  baz", "foo bar biz"]
    );
    expect(result).toEqual([
      { "0": "foo", "1": "bar", "2": "", "3": "baz" },
      { "0": "foo", "1": "bar", "2": "biz" },
    ]);
  });

  test("regex delimiter (\\s+)", () => {
    const result = runFromSplit(
      ["--delim", "\\s+"],
      ["foo bar  baz", "foo bar biz"]
    );
    expect(result).toEqual([
      { "0": "foo", "1": "bar", "2": "baz" },
      { "0": "foo", "1": "bar", "2": "biz" },
    ]);
  });
});
