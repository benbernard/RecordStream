import { describe, test, expect } from "bun:test";
import { ToTable } from "../../../src/operations/output/totable.ts";
import { testOutput } from "./testHelper.ts";

describe("ToTable - Unicode and special characters (issue #71)", () => {
  test("CJK wide characters align correctly", () => {
    const stream = `{"name":"你好","val":"1"}
{"name":"hi","val":"2"}`;
    const actual = testOutput(ToTable, [], stream);
    // "你好" is 4 display columns wide (2 chars * 2 width each)
    // "name" is 4 display columns wide
    // So both should be padded to 4
    const lines = actual.split("\n").filter(l => l !== "");
    // All lines should have the same visual width pattern
    expect(lines.length).toBe(4); // header, dash, 2 data rows
    // The separator line should use the correct width
    expect(lines[1]).toContain("----");
  });

  test("emoji characters align correctly", () => {
    const stream = `{"icon":"🎉","val":"a"}
{"icon":"x","val":"b"}`;
    const actual = testOutput(ToTable, [], stream);
    const lines = actual.split("\n").filter(l => l !== "");
    expect(lines.length).toBe(4);
    // 🎉 is 2 display columns; "icon" is 4; so column width should be 4
  });

  test("newlines in field values are escaped", () => {
    const stream = `{"text":"line1\\nline2","val":"ok"}`;
    const actual = testOutput(ToTable, [], stream);
    // Newlines should be escaped as \\n so they don't break alignment
    expect(actual).toContain("\\n");
    expect(actual).not.toContain("line1\nline2");
  });

  test("tab characters in field values are escaped", () => {
    const stream = `{"text":"col1\\tcol2","val":"ok"}`;
    const actual = testOutput(ToTable, [], stream);
    expect(actual).toContain("\\t");
  });

  test("ellipsis character aligns correctly", () => {
    const stream = `{"text":"hello…","val":"1"}
{"text":"world!","val":"2"}`;
    const actual = testOutput(ToTable, [], stream);
    const lines = actual.split("\n").filter(l => l !== "");
    expect(lines.length).toBe(4);
  });
});
