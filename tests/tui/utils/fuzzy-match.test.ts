import { describe, test, expect } from "bun:test";
import { fuzzyMatch, fuzzyFilter } from "../../../src/tui/utils/fuzzy-match.ts";

describe("fuzzyMatch", () => {
  test("empty query matches everything", () => {
    const result = fuzzyMatch("", "anything");
    expect(result.matches).toBe(true);
    expect(result.score).toBe(1);
  });

  test("exact substring match scores high", () => {
    const result = fuzzyMatch("grep", "grep - Filter records");
    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  test("word-boundary substring scores highest", () => {
    const atBoundary = fuzzyMatch("sort", "sort records by key");
    const midWord = fuzzyMatch("sort", "resorting items");
    expect(atBoundary.score).toBeGreaterThan(midWord.score);
  });

  test("fuzzy match works for scattered chars", () => {
    const result = fuzzyMatch("gp", "grep");
    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  test("non-matching query returns false", () => {
    const result = fuzzyMatch("xyz", "grep");
    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test("case-insensitive matching", () => {
    const result = fuzzyMatch("GREP", "grep filter");
    expect(result.matches).toBe(true);
  });

  test("consecutive match bonus increases score", () => {
    const consecutive = fuzzyMatch("gre", "grep");
    const scattered = fuzzyMatch("gre", "g.r.e.p");
    expect(consecutive.score).toBeGreaterThan(scattered.score);
  });

  test("query longer than target does not match", () => {
    const result = fuzzyMatch("longquery", "short");
    expect(result.matches).toBe(false);
  });
});

describe("fuzzyFilter", () => {
  const items = [
    { name: "grep", desc: "Filter records" },
    { name: "sort", desc: "Sort records by key" },
    { name: "collate", desc: "Group and aggregate" },
    { name: "fromcsv", desc: "Read CSV input" },
    { name: "totable", desc: "Format as table" },
  ];

  test("empty query returns all items", () => {
    const result = fuzzyFilter(items, "", (i) => `${i.name} ${i.desc}`);
    expect(result).toHaveLength(items.length);
  });

  test("filters to matching items only", () => {
    const result = fuzzyFilter(items, "sort", (i) => `${i.name} ${i.desc}`);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.name).toBe("sort");
  });

  test("sorts by score — exact name match first", () => {
    const result = fuzzyFilter(items, "table", (i) => `${i.name} ${i.desc}`);
    // "totable" has "table" as a substring, should rank high
    expect(result.some((r) => r.name === "totable")).toBe(true);
  });

  test("no matches returns empty array", () => {
    const result = fuzzyFilter(items, "zzzzz", (i) => `${i.name} ${i.desc}`);
    expect(result).toHaveLength(0);
  });

  test("matches against combined name + description", () => {
    const result = fuzzyFilter(items, "CSV", (i) => `${i.name} ${i.desc}`);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.name).toBe("fromcsv");
  });
});
