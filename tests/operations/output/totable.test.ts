import { describe, test, expect } from "bun:test";
import { ToTable } from "../../../src/operations/output/totable.ts";
import { testOutput } from "./testHelper.ts";

describe("ToTable", () => {
  const stream = `{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}`;

  test("default: aligned table with headers", () => {
    // Perl pads all columns including the last one
    const expected =
      "foo   zoo \n" +
      "---   ----\n" +
      "1     biz1\n" +
      "2     biz2\n" +
      "3     biz3\n" +
      "4     biz4\n" +
      "5     biz5\n";
    const actual = testOutput(ToTable, [], stream);
    expect(actual).toBe(expected);
  });

  test("--key with keygroup", () => {
    const expected =
      "foo   zoo \n" +
      "---   ----\n" +
      "1     biz1\n" +
      "2     biz2\n" +
      "3     biz3\n" +
      "4     biz4\n" +
      "5     biz5\n";
    const actual = testOutput(ToTable, ["--key", "!oo!s"], stream);
    expect(actual).toBe(expected);
  });

  test("--no-header suppresses header", () => {
    const expected =
      "1   biz1\n" +
      "2   biz2\n" +
      "3   biz3\n" +
      "4   biz4\n" +
      "5   biz5\n";
    const actual = testOutput(ToTable, ["--no-header"], stream);
    expect(actual).toBe(expected);
  });

  test("--key selects specific field", () => {
    const expected =
      "foo\n" +
      "---\n" +
      "1  \n" +
      "2  \n" +
      "3  \n" +
      "4  \n" +
      "5  \n";
    const actual = testOutput(ToTable, ["--key", "!foo!s"], stream);
    expect(actual).toBe(expected);
  });

  test("--spreadsheet mode with tab delimiter", () => {
    const expected =
      "foo\tzoo\n" +
      "1\tbiz1\n" +
      "2\tbiz2\n" +
      "3\tbiz3\n" +
      "4\tbiz4\n" +
      "5\tbiz5\n";
    const actual = testOutput(ToTable, ["--spreadsheet"], stream);
    expect(actual).toBe(expected);
  });

  test("--spreadsheet with custom delimiter", () => {
    const expected =
      "footzoo\n" +
      "1tbiz1\n" +
      "2tbiz2\n" +
      "3tbiz3\n" +
      "4tbiz4\n" +
      "5tbiz5\n";
    const actual = testOutput(ToTable, ["--spreadsheet", "--delim", "t"], stream);
    expect(actual).toBe(expected);
  });

  test("--key preserves order", () => {
    const expected =
      "zoo    foo\n" +
      "----   ---\n" +
      "biz1   1  \n" +
      "biz2   2  \n" +
      "biz3   3  \n" +
      "biz4   4  \n" +
      "biz5   5  \n";
    const actual = testOutput(ToTable, ["--key", "zoo,foo"], stream);
    expect(actual).toBe(expected);
  });

  test("empty input produces no output", () => {
    const actual = testOutput(ToTable, [], "");
    expect(actual).toBe("");
  });
});
