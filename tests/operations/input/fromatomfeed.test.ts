import { describe, test, expect } from "bun:test";
import { FromAtomFeed } from "../../../src/operations/input/fromatomfeed.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromAtomFeed(args: string[]): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromAtomFeed(collector);
  op.init(args);
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromAtomFeed", () => {
  test("follows next links by default (all 4 entries)", () => {
    const result = runFromAtomFeed(["file:tests/fixtures/testFeed1"]);
    expect(result.length).toBe(4);
    expect(result[0]!["title"]).toBe("Entry 1");
    expect(result[1]!["title"]).toBe("Entry 2");
    expect(result[2]!["title"]).toBe("Entry 3");
    expect(result[3]!["title"]).toBe("Entry 4");
  });

  test("nofollow returns only first page (2 entries)", () => {
    const result = runFromAtomFeed([
      "--nofollow",
      "file:tests/fixtures/testFeed1",
    ]);
    expect(result.length).toBe(2);
    expect(result[0]!["title"]).toBe("Entry 1");
    expect(result[1]!["title"]).toBe("Entry 2");
  });

  test("max=1 returns only 1 entry", () => {
    const result = runFromAtomFeed([
      "--max",
      "1",
      "file:tests/fixtures/testFeed1",
    ]);
    expect(result.length).toBe(1);
    expect(result[0]!["title"]).toBe("Entry 1");
  });

  test("max=2 returns 2 entries", () => {
    const result = runFromAtomFeed([
      "--max",
      "2",
      "file:tests/fixtures/testFeed1",
    ]);
    expect(result.length).toBe(2);
  });

  test("max=3 returns 3 entries (crosses page boundary)", () => {
    const result = runFromAtomFeed([
      "--max",
      "3",
      "file:tests/fixtures/testFeed1",
    ]);
    expect(result.length).toBe(3);
    expect(result[2]!["title"]).toBe("Entry 3");
  });

  test("max=3 with nofollow returns only 2 (limited by page)", () => {
    const result = runFromAtomFeed([
      "--max",
      "3",
      "--nofollow",
      "file:tests/fixtures/testFeed1",
    ]);
    expect(result.length).toBe(2);
  });

  test("entries have expected fields", () => {
    const result = runFromAtomFeed([
      "--max",
      "1",
      "file:tests/fixtures/testFeed1",
    ]);
    const entry = result[0]!;
    expect(entry["title"]).toBe("Entry 1");
    expect(entry["id"]).toBe("http://localhost/entry1");
    expect(entry["updated"]).toBe("2007-06-06T07:00:00Z");
    expect(entry["dc:creator"]).toBe("author1");
    expect(entry["author"]).toEqual({ name: "author1" });
  });
});
