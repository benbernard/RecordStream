import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";

// Import deaggregator implementations to register them
import "../../src/deaggregators/Split.ts";
import "../../src/deaggregators/Unarray.ts";
import "../../src/deaggregators/Unhash.ts";
import { deaggregatorRegistry } from "../../src/Deaggregator.ts";

function runDeaggregator(spec: string, record: Record): Record[] {
  const deagg = deaggregatorRegistry.parse(spec);
  return deagg.deaggregate(record);
}

describe("Split deaggregator", () => {
  test("splits a field by delimiter", () => {
    const record = new Record({ tags: "a;b;c", name: "test" });
    const results = runDeaggregator("split,tags,;,tag", record);
    expect(results).toHaveLength(3);
    expect(results[0]!.get("tag")).toBe("a");
    expect(results[1]!.get("tag")).toBe("b");
    expect(results[2]!.get("tag")).toBe("c");
    // Original fields preserved
    expect(results[0]!.get("name")).toBe("test");
  });

  test("splits with regex delimiter", () => {
    const record = new Record({ data: "a1b2c", name: "test" });
    const results = runDeaggregator("split,data,/\\d/,part", record);
    expect(results).toHaveLength(3);
    expect(results[0]!.get("part")).toBe("a");
    expect(results[1]!.get("part")).toBe("b");
    expect(results[2]!.get("part")).toBe("c");
  });

  test("is registered", () => {
    expect(deaggregatorRegistry.has("split")).toBe(true);
  });
});

describe("Unarray deaggregator", () => {
  test("splits an array field into records", () => {
    const record = new Record({ items: [1, 2, 3], name: "test" });
    const results = runDeaggregator("unarray,items,item", record);
    expect(results).toHaveLength(3);
    expect(results[0]!.get("item")).toBe(1);
    expect(results[1]!.get("item")).toBe(2);
    expect(results[2]!.get("item")).toBe(3);
    expect(results[0]!.get("name")).toBe("test");
  });

  test("returns empty for non-array", () => {
    const record = new Record({ items: "not an array" });
    const results = runDeaggregator("unarray,items,item", record);
    expect(results).toHaveLength(0);
  });

  test("is registered", () => {
    expect(deaggregatorRegistry.has("unarray")).toBe(true);
  });
});

describe("Unhash deaggregator", () => {
  test("splits a hash into key-value records", () => {
    const record = new Record({ data: { a: 1, b: 2 }, name: "test" });
    const results = runDeaggregator("unhash,data,key,value", record);
    expect(results).toHaveLength(2);
    // Sorted by key
    expect(results[0]!.get("key")).toBe("a");
    expect(results[0]!.get("value")).toBe(1);
    expect(results[1]!.get("key")).toBe("b");
    expect(results[1]!.get("value")).toBe(2);
    expect(results[0]!.get("name")).toBe("test");
  });

  test("splits hash with key only (no value field)", () => {
    const record = new Record({ data: { x: 1, y: 2 } });
    const results = runDeaggregator("unhash,data,key", record);
    expect(results).toHaveLength(2);
    expect(results[0]!.get("key")).toBe("x");
    expect(results[1]!.get("key")).toBe("y");
    expect(results[0]!.get("value")).toBeUndefined();
  });

  test("is registered", () => {
    expect(deaggregatorRegistry.has("unhash")).toBe(true);
  });
});
