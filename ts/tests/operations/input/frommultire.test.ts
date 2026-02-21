import { describe, test, expect } from "bun:test";
import { FromMultiRe } from "../../../src/operations/input/frommultire.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromMultiRe(
  args: string[],
  lines: string[]
): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromMultiRe(collector);
  op.init(args);
  for (const line of lines) {
    op.acceptLine(line);
  }
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromMultiRe", () => {
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

  test("basic regex extracts named fields", () => {
    const result = runFromMultiRe(
      ["--re", "fname,lname=^Name: (.*) (.*)$"],
      inputLines
    );
    expect(result).toEqual([
      { fname: "Keith", lname: "Amling" },
      { fname: "Benjamin", lname: "Bernard" },
      { fname: "Matt", lname: "Groening" },
      { fname: "David", lname: "Cohen" },
    ]);
  });

  test("$N field names use capture group values as field names", () => {
    const input2 = [
      "Team: Recs",
      "Location: 521 S Weller",
      "Name: Keith Amling",
      "Team: Futurama",
      "Location: Omicron Persei 8",
      "Name: Matt Groening",
    ];
    const result = runFromMultiRe(
      ["--re", "$1=(.*): (.*)"],
      input2
    );
    expect(result).toEqual([
      { Team: "Recs", Location: "521 S Weller", Name: "Keith Amling" },
      { Team: "Futurama", Location: "Omicron Persei 8", Name: "Matt Groening" },
    ]);
  });

  test("complex $N with multiple captures", () => {
    const result = runFromMultiRe(
      ["--re", "$1,$2=(.*),(.*)=(.*),(.*) ([A-Z]*)"],
      ["foo,bar=biz,zap ZOO", "foo,bar=ready,run ZAP"]
    );
    expect(result).toEqual([
      { foo: "biz", bar: "zap", "0-2": "ZOO" },
      { foo: "ready", bar: "run", "0-2": "ZAP" },
    ]);
  });

  test("post-flush with clobber and keep-all", () => {
    const result = runFromMultiRe(
      [
        "--re", "team=^Team: (.*)$",
        "--re", "loc=^Location: (.*)$",
        "--post", "fname,lname=^Name: (.*) (.*)$",
        "--clobber",
        "--keep-all",
      ],
      inputLines
    );
    expect(result).toEqual([
      { team: "Recs", loc: "521 S Weller", fname: "Keith", lname: "Amling" },
      { team: "Recs", loc: "521 S Weller", fname: "Benjamin", lname: "Bernard" },
      { team: "Futurama", loc: "Omicron Persei 8", fname: "Matt", lname: "Groening" },
      { team: "Futurama", loc: "Omicron Persei 8", fname: "David", lname: "Cohen" },
    ]);
  });

  test("post-flush with clobber and selective keep", () => {
    const result = runFromMultiRe(
      [
        "--re", "team=^Team: (.*)$",
        "--re", "loc=^Location: (.*)$",
        "--post", "fname,lname=^Name: (.*) (.*)$",
        "--clobber",
        "--keep", "team",
      ],
      inputLines
    );
    expect(result).toEqual([
      { team: "Recs", loc: "521 S Weller", fname: "Keith", lname: "Amling" },
      { team: "Recs", fname: "Benjamin", lname: "Bernard" },
      { team: "Futurama", loc: "Omicron Persei 8", fname: "Matt", lname: "Groening" },
      { team: "Futurama", fname: "David", lname: "Cohen" },
    ]);
  });

  test("multiple regex patterns with prefixed keys", () => {
    const result = runFromMultiRe(
      [
        "--re", "a1=^A:([^ ]*) ([^ ]*)$",
        "--re", "^B:([^ ]*) ([^ ]*) ([^ ]*)$",
      ],
      ["A:A1 A2", "B:B1 B2 B3"]
    );
    expect(result).toEqual([
      { a1: "A1", "0-1": "A2", "1-0": "B1", "1-1": "B2", "1-2": "B3" },
    ]);
  });
});
