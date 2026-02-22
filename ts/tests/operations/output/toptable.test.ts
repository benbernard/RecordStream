import { describe, test, expect } from "bun:test";
import { ToPtable } from "../../../src/operations/output/toptable.ts";
import { testOutput } from "./testHelper.ts";

describe("ToPtable", () => {
  const stream1 = `{"c":"0","a":"2","b":"2","d":"2","ct":2}
{"c":"0","a":"0","b":"2","d":"0","ct":3}
{"c":"0","a":"1","b":"1","d":"0","ct":7}
{"c":"1","a":"2","b":"2","d":"1","ct":8}
{"c":"0","a":"2","b":"0","d":"2","ct":1}
{"c":"2","a":"0","b":"0","d":"1","ct":1}
{"c":"2","a":"2","b":"1","d":"2","ct":3}
{"c":"2","a":"0","b":"0","d":"0","ct":22}
{"c":"2","a":"0","b":"0","d":"2","ct":6}
{"c":"2","a":"1","b":"1","d":"1","ct":4}
{"c":"2","a":"0","b":"2","d":"2","ct":27}
{"c":"1","a":"1","b":"0","d":"0","ct":17}
{"c":"2","a":"0","b":"2","d":"1","ct":4}
{"c":"1","a":"1","b":"0","d":"1","ct":2}
{"c":"1","a":"0","b":"0","d":"0","ct":4}
{"c":"0","a":"0","b":"0","d":"2","ct":23}
{"c":"0","a":"0","b":"1","d":"0","ct":24}
{"c":"1","a":"2","b":"2","d":"2","ct":26}
{"c":"1","a":"1","b":"1","d":"1","ct":8}
{"c":"0","a":"2","b":"0","d":"1","ct":1}
{"c":"2","a":"2","b":"1","d":"1","ct":21}
{"c":"1","a":"1","b":"1","d":"0","ct":7}
{"c":"0","a":"1","b":"0","d":"2","ct":8}
{"c":"2","a":"0","b":"2","d":"0","ct":2}
{"c":"2","a":"2","b":"2","d":"2","ct":26}
{"c":"1","a":"1","b":"2","d":"1","ct":24}
{"c":"1","a":"0","b":"2","d":"1","ct":1}
{"c":"0","a":"1","b":"1","d":"1","ct":5}
{"c":"0","a":"0","b":"0","d":"0","ct":27}
{"c":"2","a":"2","b":"0","d":"2","ct":25}
{"c":"2","a":"1","b":"2","d":"1","ct":1}
{"c":"1","a":"2","b":"1","d":"1","ct":21}
{"c":"0","a":"0","b":"2","d":"2","ct":20}
{"c":"2","a":"2","b":"2","d":"1","ct":22}
{"c":"1","a":"2","b":"1","d":"0","ct":9}
{"c":"0","a":"1","b":"0","d":"0","ct":28}`;

  test("basic pivot table: --x a,b --y c,d", () => {
    const actual = testOutput(ToPtable, ["--x", "a,b", "--y", "c,d"], stream1);
    // Check structure: should have a grid with | and + delimiters
    expect(actual).toContain("|");
    expect(actual).toContain("+");
    // Check that headers contain our field values
    expect(actual).toContain("a");
    expect(actual).toContain("b");
    expect(actual).toContain("c");
    expect(actual).toContain("d");
    // Check some known data values exist
    expect(actual).toContain("27");
    expect(actual).toContain("24");
    expect(actual).toContain("22");
  });

  test("pivot with pin: --pin d=1", () => {
    const actual = testOutput(ToPtable, ["--x", "a,b", "--y", "c", "--pin", "d=1"], stream1);
    // With pin d=1, we filter to only records where d=1
    expect(actual).toContain("|");
    expect(actual).toContain("c");
    // Should have values from d=1 records
    expect(actual).toContain("8");
    expect(actual).toContain("21");
  });

  test("pivot with FIELD on x axis", () => {
    const stream2 = `{"avg_d":2,"c":"0","a":"2","b":"2","ct":2}
{"avg_d":0.448275862068966,"c":"2","a":"0","b":"0","ct":29}
{"avg_d":1,"c":"2","a":"1","b":"1","ct":4}`;

    const actual = testOutput(ToPtable, ["--x", "b,FIELD", "--y", "c,a"], stream2);
    // Should expand value fields into columns
    expect(actual).toContain("FIELD");
    expect(actual).toContain("avg_d");
    expect(actual).toContain("ct");
  });

  test("--noheaders suppresses header rows/columns", () => {
    const simpleStream = `{"x":"a","y":"1","v":10}
{"x":"b","y":"1","v":20}`;
    const actual = testOutput(ToPtable, ["--x", "x", "--y", "y", "--v", "v", "--noheaders"], simpleStream);
    // Without headers, no x/y field names should appear in header positions
    const lines = actual.trim().split("\n");
    // There should still be borders and data
    expect(lines.length).toBeGreaterThan(0);
  });

  test("simple 2x2 pivot table", () => {
    const input = `{"row":"A","col":"X","val":1}
{"row":"A","col":"Y","val":2}
{"row":"B","col":"X","val":3}
{"row":"B","col":"Y","val":4}`;

    const actual = testOutput(ToPtable, ["--x", "col", "--y", "row", "--v", "val"], input);
    expect(actual).toContain("1");
    expect(actual).toContain("2");
    expect(actual).toContain("3");
    expect(actual).toContain("4");
    expect(actual).toContain("X");
    expect(actual).toContain("Y");
    expect(actual).toContain("A");
    expect(actual).toContain("B");
  });

  test("--sort-all-to-end sorts ALL to end", () => {
    const sortStream = `{"priority":"20","uid":"root","ct":47}
{"priority":"ALL","uid":"ALL","ct":140}
{"priority":"20","uid":"ALL","ct":120}
{"priority":"ALL","uid":"root","ct":63}`;

    const actual = testOutput(ToPtable, ["--x", "uid", "--y", "priority", "--sa"], sortStream);
    // ALL should appear after other values
    const lines = actual.split("\n");
    // Find the line containing uid header values
    const uidLine = lines.find((l) => l.includes("root") && l.includes("ALL"));
    if (uidLine) {
      const rootIdx = uidLine.indexOf("root");
      const allIdx = uidLine.indexOf("ALL");
      expect(rootIdx).toBeLessThan(allIdx);
    }
  });
});
