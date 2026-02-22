import { describe, test, expect } from "bun:test";
import { ToCsv } from "../../../src/operations/output/tocsv.ts";
import { testOutput } from "./testHelper.ts";

describe("ToCsv", () => {
  const stream = `{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}`;

  test("default: headers + all fields sorted", () => {
    const expected = `foo,zoo
1,biz1
2,biz2
3,biz3
4,biz4
5,biz5
`;
    const actual = testOutput(ToCsv, [], stream);
    expect(actual).toBe(expected);
  });

  test("--key with keygroup", () => {
    const expected = `foo,zoo
1,biz1
2,biz2
3,biz3
4,biz4
5,biz5
`;
    const actual = testOutput(ToCsv, ["--key", "!oo!s"], stream);
    expect(actual).toBe(expected);
  });

  test("--noheader suppresses header line", () => {
    const expected = `1,biz1
2,biz2
3,biz3
4,biz4
5,biz5
`;
    const actual = testOutput(ToCsv, ["--noheader"], stream);
    expect(actual).toBe(expected);
  });

  test("--key selects specific fields", () => {
    const expected = `foo
1
2
3
4
5
`;
    const actual = testOutput(ToCsv, ["--key", "foo"], stream);
    expect(actual).toBe(expected);
  });

  test("--delim changes delimiter", () => {
    const expected = `foo\tzoo
1\tbiz1
2\tbiz2
3\tbiz3
4\tbiz4
5\tbiz5
`;
    const actual = testOutput(ToCsv, ["--key", "foo,zoo", "--delim", "\t"], stream);
    expect(actual).toBe(expected);
  });

  test("delimiter must be single character", () => {
    expect(() => testOutput(ToCsv, ["--delim", "ab"], stream)).toThrow(
      "Delimiter must be a single character"
    );
  });

  test("values with commas are quoted", () => {
    const input = `{"name":"Smith, John","age":30}`;
    const actual = testOutput(ToCsv, [], input);
    expect(actual).toContain('"Smith, John"');
  });

  test("values with quotes are escaped", () => {
    const input = `{"name":"say \\"hello\\"","age":30}`;
    const actual = testOutput(ToCsv, [], input);
    expect(actual).toContain('""hello""');
  });

  test("null values produce empty fields", () => {
    const input = `{"a":null,"b":"x"}`;
    const actual = testOutput(ToCsv, [], input);
    expect(actual).toContain(",x\n");
  });
});
