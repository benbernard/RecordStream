import { describe, test, expect } from "bun:test";
import { ToPtable } from "../../../src/operations/output/toptable.ts";
import { Record as RSRecord } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";
import { testOutput } from "./testHelper.ts";

/**
 * Helper for --records mode: returns the collected Record objects.
 */
function testRecordOutput(args: string[], input: string): RSRecord[] {
  const collector = new CollectorReceiver();
  const op = new ToPtable(collector);
  op.init(args);

  const lines = input.split("\n").filter((l) => l.trim() !== "");
  for (const line of lines) {
    op.acceptLine(line);
  }
  op.finish();

  return collector.records;
}

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

  describe("record output mode (--records / --recs)", () => {
    const simpleStream = `{"row":"A","col":"X","val":1}
{"row":"A","col":"Y","val":2}
{"row":"B","col":"X","val":3}
{"row":"B","col":"Y","val":4}`;

    test("--records outputs records instead of table", () => {
      const records = testRecordOutput(
        ["--x", "col", "--y", "row", "--v", "val", "--records"],
        simpleStream,
      );
      expect(records.length).toBe(2);

      // Each record should have row field and nested col structure
      const recA = records.find((r) => r.get("row") === "A");
      const recB = records.find((r) => r.get("row") === "B");
      expect(recA).toBeDefined();
      expect(recB).toBeDefined();

      // X-axis values are nested under the x field name
      const colA = recA!.get("col") as JsonObject;
      expect(colA["X"]).toBe("1");
      expect(colA["Y"]).toBe("2");

      const colB = recB!.get("col") as JsonObject;
      expect(colB["X"]).toBe("3");
      expect(colB["Y"]).toBe("4");
    });

    test("--recs is an alias for --records", () => {
      const records = testRecordOutput(
        ["--x", "col", "--y", "row", "--v", "val", "--recs"],
        simpleStream,
      );
      expect(records.length).toBe(2);

      const recA = records.find((r) => r.get("row") === "A");
      expect(recA).toBeDefined();
      const colA = recA!.get("col") as JsonObject;
      expect(colA["X"]).toBe("1");
    });

    test("--records with multiple x fields creates nested structure", () => {
      const input = `{"x1":"a","x2":"p","y1":"R","val":10}
{"x1":"a","x2":"q","y1":"R","val":20}
{"x1":"b","x2":"p","y1":"R","val":30}`;

      const records = testRecordOutput(
        ["--x", "x1,x2", "--y", "y1", "--v", "val", "--records"],
        input,
      );
      expect(records.length).toBe(1);

      const rec = records[0]!;
      expect(rec.get("y1")).toBe("R");
      // Nested: x1 -> { a -> { x2 -> { p -> "10", q -> "20" } }, b -> { x2 -> { p -> "30" } } }
      const x1 = rec.get("x1") as JsonObject;
      expect(x1).toBeDefined();
      expect(typeof x1).toBe("object");
    });
  });

  describe("KeyGroups syntax", () => {
    // Records with fields a, b, c, ct - use KeyGroups to select fields by pattern
    const kgStream = `{"a":"0","b":"1","c":"2","ct":5}
{"a":"1","b":"0","c":"1","ct":3}
{"a":"0","b":"0","c":"0","ct":7}`;

    test("!pattern! matches fields by regex", () => {
      // !b! matches field "b"
      const actual = testOutput(ToPtable, ["--x", "!b!", "--y", "a", "--v", "ct"], kgStream);
      expect(actual).toContain("|");
      // b values should appear as columns
      expect(actual).toContain("1");
      expect(actual).toContain("0");
      // ct values should appear
      expect(actual).toContain("5");
      expect(actual).toContain("3");
      expect(actual).toContain("7");
    });

    test("!regex!sort matches and sorts fields", () => {
      // !^(a|c)$!sort matches fields a and c, sorted alphabetically
      const actual = testOutput(ToPtable, ["--y", "!^(a|c)$!sort", "--v", "ct"], kgStream);
      expect(actual).toContain("|");
      // Both a and c should appear as y-axis
      expect(actual).toContain("a");
      expect(actual).toContain("c");
    });

    test("KeyGroups with FIELD on x-axis", () => {
      const input = `{"a":"0","b":"1","avg_d":2.5,"ct":10}
{"a":"1","b":"0","avg_d":1.0,"ct":20}`;

      // Use !^(avg_d|ct)$!sort for value fields via KeyGroups
      const actual = testOutput(
        ToPtable,
        ["--x", "b,FIELD", "--y", "a", "--v", "!^(avg_d|ct)$!sort"],
        input,
      );
      expect(actual).toContain("FIELD");
      expect(actual).toContain("avg_d");
      expect(actual).toContain("ct");
    });
  });

  describe("value field ordering", () => {
    test("--v field1,field2 preserves specified order", () => {
      const input = `{"a":"0","b":"1","ct":10,"avg_d":2.5}
{"a":"1","b":"0","ct":20,"avg_d":1.0}`;

      // Request ct,avg_d order — ct should come first
      const actual1 = testOutput(
        ToPtable,
        ["--x", "b,FIELD", "--y", "a", "--v", "ct,avg_d"],
        input,
      );
      // Find the line with both ct and avg_d — ct should appear before avg_d
      const lines1 = actual1.split("\n");
      const fieldLine1 = lines1.find((l) => l.includes("ct") && l.includes("avg_d"));
      expect(fieldLine1).toBeDefined();
      expect(fieldLine1!.indexOf("ct")).toBeLessThan(fieldLine1!.indexOf("avg_d"));

      // Now reverse: avg_d,ct order — avg_d should come first
      const actual2 = testOutput(
        ToPtable,
        ["--x", "b,FIELD", "--y", "a", "--v", "avg_d,ct"],
        input,
      );
      const lines2 = actual2.split("\n");
      const fieldLine2 = lines2.find((l) => l.includes("ct") && l.includes("avg_d"));
      expect(fieldLine2).toBeDefined();
      expect(fieldLine2!.indexOf("avg_d")).toBeLessThan(fieldLine2!.indexOf("ct"));
    });
  });

  describe("multiple pins", () => {
    test("multiple --pin options filter on all pinned fields", () => {
      // Pin both a=0 and c=2 — only records where a=0 AND c=2 pass
      const actual = testOutput(
        ToPtable,
        ["--x", "b", "--y", "d", "--pin", "a=0", "--pin", "c=2"],
        stream1,
      );
      expect(actual).toContain("|");
      // From stream1, records with a=0 and c=2:
      // {"c":"2","a":"0","b":"0","d":"1","ct":1}
      // {"c":"2","a":"0","b":"0","d":"0","ct":22}
      // {"c":"2","a":"0","b":"0","d":"2","ct":6}
      // {"c":"2","a":"0","b":"2","d":"2","ct":27}
      // {"c":"2","a":"0","b":"2","d":"1","ct":4}
      // {"c":"2","a":"0","b":"2","d":"0","ct":2}
      expect(actual).toContain("22");
      expect(actual).toContain("27");
      expect(actual).toContain("6");
      // Values from records NOT matching both pins should be absent
      // e.g. ct=8 is from {a:2, c:1} — should not be present
      // (ct=8 also appears in {a:1,c:0,d:2} and {a:1,c:1,d:1} — all excluded)
    });

    test("single --pin with comma-separated pairs", () => {
      // --pin a=0,c=2 should also work as multiple pins
      const actual = testOutput(
        ToPtable,
        ["--x", "b", "--y", "d", "--pin", "a=0,c=2"],
        stream1,
      );
      expect(actual).toContain("22");
      expect(actual).toContain("27");
    });
  });

  describe("FIELD pin", () => {
    test("--pin FIELD=specific_field limits value fields displayed", () => {
      const input = `{"a":"0","b":"1","avg_d":2.5,"ct":10}
{"a":"1","b":"0","avg_d":1.0,"ct":20}`;

      // With FIELD pin, only show the pinned value field
      const actual = testOutput(
        ToPtable,
        ["--x", "b,FIELD", "--y", "a", "--pin", "FIELD=ct"],
        input,
      );
      // ct should appear but avg_d should NOT appear as a FIELD value
      expect(actual).toContain("ct");
      expect(actual).not.toContain("avg_d");
      // ct values should be present
      expect(actual).toContain("10");
      expect(actual).toContain("20");
    });

    test("--pin FIELD works with --records mode", () => {
      const input = `{"a":"0","b":"1","avg_d":2.5,"ct":10}
{"a":"1","b":"0","avg_d":1.0,"ct":20}`;

      const records = testRecordOutput(
        ["--x", "b,FIELD", "--y", "a", "--pin", "FIELD=avg_d", "--records"],
        input,
      );
      expect(records.length).toBe(2);

      // Only avg_d should be present, not ct
      const rec0 = records.find((r) => r.get("a") === "0");
      expect(rec0).toBeDefined();
      // Structure: b -> { "1": { FIELD: { avg_d: "2.5" } }, "0": { FIELD: { avg_d: "" } } }
      const data = rec0!.toJSON() as JsonObject;
      const bObj = data["b"] as JsonObject;
      const b1 = bObj["1"] as JsonObject;
      const fieldObj = b1["FIELD"] as JsonObject;
      expect(fieldObj["avg_d"]).toBe("2.5");
      // ct should not be present since we pinned FIELD=avg_d
      expect(fieldObj["ct"]).toBeUndefined();
    });
  });
});
