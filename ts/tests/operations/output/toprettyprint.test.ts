import { describe, test, expect } from "bun:test";
import { ToPrettyPrint } from "../../../src/operations/output/toprettyprint.ts";
import { testOutput } from "./testHelper.ts";

describe("ToPrettyPrint", () => {
  const stream = `{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}`;

  test("default: all records pretty printed", () => {
    const expected = `----------------------------------------------------------------------
foo = 1
zoo = "biz1"
----------------------------------------------------------------------
foo = 2
zoo = "biz2"
----------------------------------------------------------------------
foo = 3
zoo = "biz3"
----------------------------------------------------------------------
foo = 4
zoo = "biz4"
----------------------------------------------------------------------
foo = 5
zoo = "biz5"
`;
    const actual = testOutput(ToPrettyPrint, [], stream);
    expect(actual).toBe(expected);
  });

  test("--one prints only first record", () => {
    const expected = `----------------------------------------------------------------------
foo = 1
zoo = "biz1"
`;
    const actual = testOutput(ToPrettyPrint, ["--one"], stream);
    expect(actual).toBe(expected);
  });

  test("nested hash output", () => {
    const input = `{"foo":5,"zoo":"biz5","zap":{"bar":3}}`;
    const expected = `----------------------------------------------------------------------
foo = 5
zap = HASH:
   bar = 3
zoo = "biz5"
`;
    const actual = testOutput(ToPrettyPrint, ["--one"], input);
    expect(actual).toBe(expected);
  });

  test("--nonested suppresses nested output", () => {
    const input = `{"foo":5,"zoo":"biz5","zap":{"bar":3}}`;
    const expected = `----------------------------------------------------------------------
foo = 5
zap = {"bar":3}
zoo = "biz5"
`;
    const actual = testOutput(ToPrettyPrint, ["--one", "--nonested"], input);
    expect(actual).toBe(expected);
  });

  test("empty hash and array handling", () => {
    const input = `{"foo":{},"zoo":"biz5","zap":["bar",{"one":1}]}`;
    const expected = `----------------------------------------------------------------------
foo = EMPTY HASH
zap = ARRAY:
   0 = HASH:
      one = 1
   1 = "bar"
zoo = "biz5"
`;
    const actual = testOutput(ToPrettyPrint, ["--one"], input);
    expect(actual).toBe(expected);
  });

  test("--n limits to n records", () => {
    const actual = testOutput(ToPrettyPrint, ["--n", "2"], stream);
    const lines = actual.split("\n");
    const dashLines = lines.filter((l) => l.startsWith("---"));
    expect(dashLines.length).toBe(2);
  });
});
