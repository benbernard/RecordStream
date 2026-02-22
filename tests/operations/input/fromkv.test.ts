import { describe, test, expect } from "bun:test";
import { FromKv } from "../../../src/operations/input/fromkv.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromKv(
  args: string[],
  lines: string[]
): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromKv(collector);
  op.init(args);
  for (const line of lines) {
    op.acceptLine(line);
  }
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromKv", () => {
  test("kv-delim = with record-delim %\\n", () => {
    const lines = [
      "",
      "a=1",
      "b=2",
      "c=3",
      "%",
      "d=4",
      "e=5",
      "f=6",
      "%",
    ];
    const result = runFromKv(
      ["--kv-delim", "=", "--record-delim", "%\n"],
      lines
    );
    expect(result).toEqual([
      { a: "1", b: "2", c: "3" },
      { d: "4", e: "5", f: "6" },
    ]);
  });

  test("kv-delim = entry-delim | record-delim %\\n", () => {
    const lines = ["a=1|b=2|c=3%", "d=4|e=5|f=6%"];
    const result = runFromKv(
      ["--kv-delim", "=", "--entry-delim", "|", "--record-delim", "%\n"],
      lines
    );
    expect(result).toEqual([
      { a: "1", b: "2", c: "3" },
      { d: "4", e: "5", f: "6" },
    ]);
  });

  test("kv-delim = entry-delim | record-delim % (no newline)", () => {
    // Input: "a=1|b=2|c=3%d=4|e=5|f=6" as a single line
    const result = runFromKv(
      ["--kv-delim", "=", "--entry-delim", "|", "--record-delim", "%"],
      ["a=1|b=2|c=3%d=4|e=5|f=6"]
    );
    // The first record should be extracted on record-delim match
    // The second record comes from streamDone
    expect(result.length).toBe(2);
    expect(result[0]).toEqual({ a: "1", b: "2", c: "3" });
    expect(result[1]).toEqual({ d: "4", e: "5", f: "6" });
  });
});
