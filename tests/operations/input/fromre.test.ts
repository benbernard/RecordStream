import { describe, test, expect } from "bun:test";
import { FromRe } from "../../../src/operations/input/fromre.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromRe(
  args: string[],
  lines: string[]
): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromRe(collector);
  op.init(args);
  for (const line of lines) {
    op.processLine(line);
  }
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromRe", () => {
  const inputLines = [
    "Team: Recs",
    "Location: 521 S Weller",
    "Name: Keith Amling",
    "Name: Benjamin Bernard",
    "Team: Futurama",
    "Location: Omicron Persei 8",
    "Name: Matt Groening",
    "Name: David Cohen",
  ];

  test("basic regex with named fields", () => {
    const result = runFromRe(
      ["-f", "fname,lname", "^Name: (.*) (.*)$"],
      inputLines
    );
    expect(result).toEqual([
      { fname: "Keith", lname: "Amling" },
      { fname: "Benjamin", lname: "Bernard" },
      { fname: "Matt", lname: "Groening" },
      { fname: "David", lname: "Cohen" },
    ]);
  });

  test("partial named fields", () => {
    const result = runFromRe(
      ["-f", "a1", "^A:([^ ]*) ([^ ]*) ([^ ]*)$"],
      ["A:A1 A2 A3"]
    );
    expect(result).toEqual([{ a1: "A1", "1": "A2", "2": "A3" }]);
  });

  test("no named fields (numeric keys)", () => {
    const result = runFromRe(
      ["^A:([^ ]*) ([^ ]*) ([^ ]*)$"],
      ["A:A1 A2 A3"]
    );
    expect(result).toEqual([{ "0": "A1", "1": "A2", "2": "A3" }]);
  });

  test("non-matching lines are skipped", () => {
    const result = runFromRe(["^Name: (.*)$"], inputLines);
    expect(result.length).toBe(4);
  });

  test("missing expression throws", () => {
    expect(() => {
      const op = new FromRe();
      op.init([]);
    }).toThrow("Missing expression");
  });
});
