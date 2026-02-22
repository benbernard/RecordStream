import { describe, test, expect } from "bun:test";
import { ToHtml } from "../../../src/operations/output/tohtml.ts";
import { testOutput } from "./testHelper.ts";

describe("ToHtml", () => {
  const stream = `{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}`;

  test("default: HTML table with headers", () => {
    const expected = `<table>
  <tr>
    <th>foo</th>
    <th>zoo</th>
  </tr>
  <tr>
    <td>1</td>
    <td>biz1</td>
  </tr>
  <tr>
    <td>2</td>
    <td>biz2</td>
  </tr>
  <tr>
    <td>3</td>
    <td>biz3</td>
  </tr>
  <tr>
    <td>4</td>
    <td>biz4</td>
  </tr>
  <tr>
    <td>5</td>
    <td>biz5</td>
  </tr>
</table>
`;
    const actual = testOutput(ToHtml, [], stream);
    expect(actual).toBe(expected);
  });

  test("--key with keygroup", () => {
    const expected = `<table>
  <tr>
    <th>foo</th>
    <th>zoo</th>
  </tr>
  <tr>
    <td>1</td>
    <td>biz1</td>
  </tr>
  <tr>
    <td>2</td>
    <td>biz2</td>
  </tr>
  <tr>
    <td>3</td>
    <td>biz3</td>
  </tr>
  <tr>
    <td>4</td>
    <td>biz4</td>
  </tr>
  <tr>
    <td>5</td>
    <td>biz5</td>
  </tr>
</table>
`;
    const actual = testOutput(ToHtml, ["--key", "!.!s"], stream);
    expect(actual).toBe(expected);
  });

  test("--fields selects specific field", () => {
    const actual = testOutput(ToHtml, ["--fields", "foo"], stream);
    expect(actual).toContain("<th>foo</th>");
    expect(actual).not.toContain("<th>zoo</th>");
  });

  test("--noheader suppresses header row", () => {
    const actual = testOutput(ToHtml, ["--noheader"], stream);
    expect(actual).not.toContain("<th>");
    expect(actual).toContain("<td>");
  });

  test("--row and --cell attributes", () => {
    const actual = testOutput(ToHtml, ["--row", "bar=zap", "--cell", "biz=bam"], stream);
    expect(actual).toContain("<tr bar=zap>");
    expect(actual).toContain("<th biz=bam>foo</th>");
    expect(actual).toContain("<td biz=bam>1</td>");
  });

  test("empty values produce empty cells", () => {
    const input = `{"a":null,"b":"x"}`;
    const actual = testOutput(ToHtml, [], input);
    expect(actual).toContain("<td></td>");
    expect(actual).toContain("<td>x</td>");
  });
});
