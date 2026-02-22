import { describe, test, expect } from "bun:test";
import { Record } from "../src/Record.ts";

describe("Record", () => {
  describe("constructor", () => {
    test("creates empty record with no args", () => {
      const r = new Record();
      expect(r.keys()).toEqual([]);
    });

    test("creates record from object", () => {
      const r = new Record({ name: "John", age: 39 });
      expect(r.get("name")).toBe("John");
      expect(r.get("age")).toBe(39);
    });
  });

  describe("get/set", () => {
    test("get returns undefined for missing key", () => {
      const r = new Record();
      expect(r.get("missing")).toBeUndefined();
    });

    test("set returns old value", () => {
      const r = new Record({ x: 1 });
      const old = r.set("x", 2);
      expect(old).toBe(1);
      expect(r.get("x")).toBe(2);
    });

    test("set returns undefined for new key", () => {
      const r = new Record();
      const old = r.set("x", 1);
      expect(old).toBeUndefined();
      expect(r.get("x")).toBe(1);
    });
  });

  describe("has", () => {
    test("returns true for existing key", () => {
      const r = new Record({ x: 1 });
      expect(r.has("x")).toBe(true);
    });

    test("returns false for missing key", () => {
      const r = new Record({ x: 1 });
      expect(r.has("y")).toBe(false);
    });

    test("returns true for null values", () => {
      const r = new Record({ x: null });
      expect(r.has("x")).toBe(true);
    });
  });

  describe("remove", () => {
    test("removes single field and returns old value", () => {
      const r = new Record({ a: 1, b: 2 });
      const old = r.remove("a");
      expect(old).toEqual([1]);
      expect(r.has("a")).toBe(false);
      expect(r.get("b")).toBe(2);
    });

    test("removes multiple fields", () => {
      const r = new Record({ a: 1, b: 2, c: 3 });
      const old = r.remove("a", "c");
      expect(old).toEqual([1, 3]);
      expect(r.keys()).toEqual(["b"]);
    });

    test("returns undefined for missing fields", () => {
      const r = new Record({ a: 1 });
      const old = r.remove("missing");
      expect(old).toEqual([undefined]);
    });
  });

  describe("rename", () => {
    test("renames existing field", () => {
      const r = new Record({ old: "value" });
      r.rename("old", "new");
      expect(r.has("old")).toBe(false);
      expect(r.get("new")).toBe("value");
    });

    test("creates null field when renaming non-existent", () => {
      const r = new Record({});
      r.rename("missing", "new");
      expect(r.has("new")).toBe(true);
      expect(r.get("new")).toBeNull();
    });
  });

  describe("pruneTo", () => {
    test("keeps only specified keys", () => {
      const r = new Record({ a: 1, b: 2, c: 3, d: 4 });
      r.pruneTo("a", "c");
      expect(r.keys().sort()).toEqual(["a", "c"]);
      expect(r.get("a")).toBe(1);
      expect(r.get("c")).toBe(3);
    });
  });

  describe("keys", () => {
    test("returns all field names", () => {
      const r = new Record({ x: 1, y: 2, z: 3 });
      expect(r.keys().sort()).toEqual(["x", "y", "z"]);
    });
  });

  describe("clone", () => {
    test("creates deep copy", () => {
      const r = new Record({ a: 1, nested: { b: 2 } });
      const c = r.clone();
      c.set("a", 99);
      expect(r.get("a")).toBe(1);
      expect(c.get("a")).toBe(99);
    });

    test("deep copy of nested objects", () => {
      const r = new Record({ nested: { arr: [1, 2, 3] } });
      const c = r.clone();
      // Mutate clone's nested data
      const nested = c.get("nested") as { arr: number[] };
      nested.arr.push(4);
      // Original should be unaffected
      const orig = r.get("nested") as { arr: number[] };
      expect(orig.arr).toEqual([1, 2, 3]);
    });
  });

  describe("toJSON / dataRef", () => {
    test("toJSON returns shallow copy", () => {
      const r = new Record({ a: 1 });
      const json = r.toJSON();
      json["a"] = 99;
      expect(r.get("a")).toBe(1);
    });

    test("dataRef returns mutable reference", () => {
      const r = new Record({ a: 1 });
      const ref = r.dataRef();
      ref["a"] = 99;
      expect(r.get("a")).toBe(99);
    });
  });

  describe("toString / fromJSON", () => {
    test("toString serializes to JSON", () => {
      const r = new Record({ a: 1, b: "hello" });
      const str = r.toString();
      const parsed = JSON.parse(str);
      expect(parsed).toEqual({ a: 1, b: "hello" });
    });

    test("fromJSON parses JSON line", () => {
      const r = Record.fromJSON('{"name":"test","val":42}');
      expect(r.get("name")).toBe("test");
      expect(r.get("val")).toBe(42);
    });

    test("fromJSON rejects non-objects", () => {
      expect(() => Record.fromJSON("[1,2,3]")).toThrow();
      expect(() => Record.fromJSON('"string"')).toThrow();
      expect(() => Record.fromJSON("42")).toThrow();
      expect(() => Record.fromJSON("null")).toThrow();
    });

    test("roundtrip", () => {
      const orig = new Record({ x: [1, 2], y: { z: true } });
      const restored = Record.fromJSON(orig.toString());
      expect(restored.toJSON()).toEqual(orig.toJSON());
    });
  });

  describe("sort / cmp", () => {
    test("lexical sort ascending (default)", () => {
      const records = [
        new Record({ name: "Charlie" }),
        new Record({ name: "Alice" }),
        new Record({ name: "Bob" }),
      ];
      const sorted = Record.sort(records, "name");
      expect(sorted.map((r) => r.get("name"))).toEqual([
        "Alice",
        "Bob",
        "Charlie",
      ]);
    });

    test("lexical sort descending", () => {
      const records = [
        new Record({ name: "Charlie" }),
        new Record({ name: "Alice" }),
        new Record({ name: "Bob" }),
      ];
      const sorted = Record.sort(records, "name=-lexical");
      expect(sorted.map((r) => r.get("name"))).toEqual([
        "Charlie",
        "Bob",
        "Alice",
      ]);
    });

    test("numeric sort ascending", () => {
      const records = [
        new Record({ val: 10 }),
        new Record({ val: 2 }),
        new Record({ val: 20 }),
      ];
      const sorted = Record.sort(records, "val=numeric");
      expect(sorted.map((r) => r.get("val"))).toEqual([2, 10, 20]);
    });

    test("numeric sort descending", () => {
      const records = [
        new Record({ val: 10 }),
        new Record({ val: 2 }),
        new Record({ val: 20 }),
      ];
      const sorted = Record.sort(records, "val=-numeric");
      expect(sorted.map((r) => r.get("val"))).toEqual([20, 10, 2]);
    });

    test("ALL hack sorts ALL to end", () => {
      const records = [
        new Record({ g: "ALL" }),
        new Record({ g: "a" }),
        new Record({ g: "b" }),
      ];
      const sorted = Record.sort(records, "g=+lexical*");
      expect(sorted.map((r) => r.get("g"))).toEqual(["a", "b", "ALL"]);
    });

    test("multi-key sort", () => {
      const records = [
        new Record({ group: "B", val: 2 }),
        new Record({ group: "A", val: 3 }),
        new Record({ group: "A", val: 1 }),
        new Record({ group: "B", val: 1 }),
      ];
      const sorted = Record.sort(records, "group", "val=numeric");
      expect(sorted.map((r) => [r.get("group"), r.get("val")])).toEqual([
        ["A", 1],
        ["A", 3],
        ["B", 1],
        ["B", 2],
      ]);
    });

    test("stable sort preserves original order for equal elements", () => {
      const records = [
        new Record({ group: "A", idx: 0 }),
        new Record({ group: "A", idx: 1 }),
        new Record({ group: "A", idx: 2 }),
      ];
      const sorted = Record.sort(records, "group");
      expect(sorted.map((r) => r.get("idx"))).toEqual([0, 1, 2]);
    });

    test("cmp returns 0 for equal records", () => {
      const a = new Record({ x: "same" });
      const b = new Record({ x: "same" });
      expect(a.cmp(b, "x")).toBe(0);
    });

    test("cmp returns negative/positive for ordering", () => {
      const a = new Record({ x: "alice" });
      const b = new Record({ x: "bob" });
      expect(a.cmp(b, "x")).toBeLessThan(0);
      expect(b.cmp(a, "x")).toBeGreaterThan(0);
    });

    test("invalid comparator name throws", () => {
      expect(() => Record.getComparator("x=+bogus")).toThrow(
        "Not a valid comparator"
      );
    });
  });

  describe("nested dot-path access via sort", () => {
    test("sorts by nested field", () => {
      const records = [
        new Record({ info: { age: 30 } }),
        new Record({ info: { age: 20 } }),
        new Record({ info: { age: 25 } }),
      ];
      const sorted = Record.sort(records, "info/age=numeric");
      expect(
        sorted.map((r) => (r.get("info") as { age: number }).age)
      ).toEqual([20, 25, 30]);
    });
  });
});
