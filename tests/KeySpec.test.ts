import { describe, test, expect, beforeEach } from "bun:test";
import { KeySpec, findKey, setKey, clearKeySpecCaches, NoSuchKeyError } from "../src/KeySpec.ts";
import type { JsonObject } from "../src/types/json.ts";

beforeEach(() => {
  clearKeySpecCaches();
});

describe("KeySpec", () => {
  describe("basic key resolution", () => {
    const data = {
      first_key: "foo",
      second_key: { bar: "biz" },
      "0": "zero",
    };

    test("exact key spec match", () => {
      expect(findKey(data, "first_key")).toBe("foo");
    });

    test("exact key spec match via KeySpec object", () => {
      const spec = new KeySpec("first_key");
      const result = spec.resolve(data);
      expect(result.value).toBe("foo");
    });

    test("key doesn't exist returns undefined", () => {
      expect(findKey(data, "does_not_exist")).toBeUndefined();
    });

    test("nested hash access", () => {
      expect(findKey(data, "second_key/bar")).toBe("biz");
    });

    test("number-only key at first level", () => {
      expect(findKey(data, "0")).toBe("zero");
    });
  });

  describe("fuzzy matching", () => {
    const data = {
      first_key: "foo",
      second_key: { bar: "biz" },
      "0": "zero",
    };

    test("prefix matching with @", () => {
      expect(findKey(data, "@first")).toBe("foo");
    });

    test("nested substring matching with @", () => {
      expect(findKey(data, "@cond/ar")).toBe("biz");
    });

    test("number-only key at first level with fuzzy", () => {
      expect(findKey(data, "@0")).toBe("zero");
    });
  });

  describe("array access", () => {
    test("array index with #N", () => {
      const data = { arr: [10, 20, 30] };
      expect(findKey(data, "arr/#0")).toBe(10);
      expect(findKey(data, "arr/#1")).toBe(20);
      expect(findKey(data, "arr/#2")).toBe(30);
    });

    test("nested array of hashes", () => {
      const data = { items: [{ name: "a" }, { name: "b" }] };
      expect(findKey(data, "items/#0/name")).toBe("a");
      expect(findKey(data, "items/#1/name")).toBe("b");
    });

    test("throws for non-numeric array index", () => {
      const data = { arr: [1, 2, 3] };
      expect(() => findKey(data, "arr/notaindex")).toThrow("Cannot select non-numeric index");
    });
  });

  describe("escaped slashes", () => {
    test("literal slash in key name", () => {
      const data = { "foo/bar": 2 };
      expect(findKey(data, "foo\\/bar")).toBe(2);
    });
  });

  describe("has_key_spec", () => {
    test("returns true for existing key", () => {
      const ks = new KeySpec("foo/bar");
      expect(ks.hasKeySpec({ foo: { bar: 1 } })).toBe(true);
    });

    test("returns false for missing key", () => {
      const ks = new KeySpec("foo/baz");
      expect(ks.hasKeySpec({ foo: { bar: 1 } })).toBe(false);
    });

    test("returns true for top-level key", () => {
      const ks = new KeySpec("x");
      expect(ks.hasKeySpec({ x: 42 })).toBe(true);
    });

    test("returns false for missing top-level key", () => {
      const ks = new KeySpec("y");
      expect(ks.hasKeySpec({ x: 42 })).toBe(false);
    });
  });

  describe("get_key_list_for_spec", () => {
    test("returns key chain for nested spec", () => {
      const ks = new KeySpec("foo/bar");
      expect(ks.getKeyListForSpec({ foo: { bar: 1 } })).toEqual(["foo", "bar"]);
    });

    test("returns key chain with array indices", () => {
      const ks = new KeySpec("arr/#0");
      expect(ks.getKeyListForSpec({ arr: [42] })).toEqual(["arr", "#0"]);
    });

    test("returns empty for missing spec", () => {
      const ks = new KeySpec("foo/bar");
      expect(ks.getKeyListForSpec({ baz: 1 })).toEqual([]);
    });
  });

  describe("setKey / setValue", () => {
    test("sets top-level key", () => {
      const data = { x: 1 };
      setKey(data, "x", 42);
      expect(data.x).toBe(42);
    });

    test("sets nested key", () => {
      const data: JsonObject = { foo: { bar: 1 } };
      setKey(data, "foo/bar", 99);
      expect((data["foo"] as { bar: number }).bar).toBe(99);
    });

    test("vivifies intermediate hashes", () => {
      const data: JsonObject = {};
      setKey(data, "a/b/c", "deep");
      expect((data["a"] as { b: { c: string } }).b.c).toBe("deep");
    });

    test("vivifies intermediate arrays", () => {
      const data: JsonObject = {};
      setKey(data, "a/#0", "first");
      expect((data["a"] as string[])[0]).toBe("first");
    });
  });

  describe("noVivify / throwError", () => {
    test("noVivify prevents creation of intermediates", () => {
      const data = {};
      const ks = new KeySpec("a/b");
      const result = ks.resolve(data, true, false);
      expect(result.found).toBe(false);
      // Should not have created 'a'
      expect("a" in data).toBe(false);
    });

    test("throwError throws NoSuchKeyError", () => {
      const data = {};
      const ks = new KeySpec("missing");
      expect(() => ks.resolve(data, true, true)).toThrow(NoSuchKeyError);
    });
  });

  describe("caching", () => {
    test("same spec string returns cached KeySpec", () => {
      clearKeySpecCaches();
      const a = new KeySpec("test/key");
      const b = new KeySpec("test/key");
      expect(a.parsedKeys).toEqual(b.parsedKeys);
      expect(a.fuzzy).toBe(b.fuzzy);
    });
  });
});
