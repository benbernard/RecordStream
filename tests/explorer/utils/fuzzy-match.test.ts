import { describe, test, expect } from "bun:test";
import { fuzzyMatch, fuzzyFilter } from "../../../src/explorer/utils/fuzzy-match.ts";

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

describe("fuzzyFilter with getName (name-first matching)", () => {
  // Simulate the operation list from AddStageModal
  const ops = [
    { name: "fromapache", desc: "Each line of input is parsed to produce an output record for each request" },
    { name: "fromatomfeed", desc: "Produce records from atom feed entries" },
    { name: "fromcsv", desc: "Each line of input is split on commas to produce a record" },
    { name: "fromps", desc: "Generate records from the process table" },
    { name: "fromsplit", desc: "Each line of input is split on the provided delimiter" },
    { name: "grep", desc: "Filter records where an expression evaluates to true" },
    { name: "sort", desc: "Sort records from input or from files" },
    { name: "collate", desc: "Take records, grouped together by keys, and compute statistics" },
    { name: "xform", desc: "Transform records with a JS snippet" },
    { name: "totable", desc: "Pretty prints a table of records to the screen" },
    { name: "toptable", desc: "Creates a multi-dimensional pivot table" },
    { name: "tohtml", desc: "Prints out an HTML table for the records" },
    { name: "tocsv", desc: "Write records as CSV output" },
  ];

  const filter = (query: string) =>
    fuzzyFilter(ops, query, (d) => `${d.name} ${d.desc}`, {
      getName: (d) => d.name,
      minScore: 50,
    });

  test("'fromps' returns fromps as the first (and ideally only) result", () => {
    const result = filter("fromps");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.name).toBe("fromps");
    // Should NOT include unrelated from* operations
    expect(result.some((r) => r.name === "fromapache")).toBe(false);
    expect(result.some((r) => r.name === "xform")).toBe(false);
  });

  test("'totable' returns totable first, not buried under other results", () => {
    const result = filter("totable");
    expect(result[0]!.name).toBe("totable");
    // toptable is a reasonable fuzzy-name match
    if (result.length > 1) {
      expect(result[1]!.name).toBe("toptable");
    }
    // Should NOT include unrelated operations like fromps
    expect(result.some((r) => r.name === "fromps")).toBe(false);
  });

  test("'grep' returns only grep, not scattered description matches", () => {
    const result = filter("grep");
    expect(result[0]!.name).toBe("grep");
    // Most other operations should be filtered out
    expect(result.length).toBeLessThan(5);
  });

  test("'from' prefix shows all from* operations ranked by name relevance", () => {
    const result = filter("from");
    // All from* operations should appear
    const fromOps = result.filter((r) => r.name.startsWith("from"));
    expect(fromOps.length).toBe(5); // all 5 from* ops in our list
    // from* operations should come before any description-only matches
    const firstNonFrom = result.findIndex((r) => !r.name.startsWith("from"));
    if (firstNonFrom !== -1) {
      expect(firstNonFrom).toBeGreaterThanOrEqual(5);
    }
  });

  test("name matches always rank above description-only matches", () => {
    const result = filter("table");
    // totable, toptable have "table" in their name → should rank first
    const nameMatches = result.filter(
      (r) => r.name === "totable" || r.name === "toptable",
    );
    expect(nameMatches.length).toBe(2);
    expect(result.indexOf(nameMatches[0]!)).toBeLessThan(
      result.findIndex((r) => r.name !== "totable" && r.name !== "toptable" && r.name !== "stream2table"),
    );
  });

  test("minScore filters out low-quality fuzzy description matches", () => {
    // "fromps" should NOT appear when searching "totable" (it only matched
    // via scattered chars in the description in the old implementation)
    const result = filter("totable");
    expect(result.some((r) => r.name === "fromps")).toBe(false);
    expect(result.some((r) => r.name === "grep")).toBe(false);
  });

  test("fuzzy name matching still works for abbreviated queries", () => {
    // "fmps" is a fuzzy abbreviation of "fromps"
    const result = filter("fmps");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.name).toBe("fromps");
  });

  test("description substring matches still work when name doesn't match", () => {
    // "process" doesn't match any name but appears in fromps description
    const result = filter("process");
    expect(result.some((r) => r.name === "fromps")).toBe(true);
  });

  test("empty query returns all items unchanged", () => {
    const result = filter("");
    expect(result).toHaveLength(ops.length);
  });

  test("backward compatible — works without options", () => {
    const result = fuzzyFilter(ops, "grep", (d) => `${d.name} ${d.desc}`);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.name).toBe("grep");
  });
});
