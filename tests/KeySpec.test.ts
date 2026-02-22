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

  describe("compiled accessors", () => {
    describe("compiled getter — nested keys", () => {
      test("2-level nested key via resolve", () => {
        const ks = new KeySpec("foo/bar");
        const data = { foo: { bar: 42 } };
        const result = ks.resolve(data, true);
        expect(result.value).toBe(42);
        expect(result.found).toBe(true);
      });

      test("3-level nested key via resolve", () => {
        const ks = new KeySpec("a/b/c");
        const data = { a: { b: { c: "deep" } } };
        expect(ks.resolve(data, true).value).toBe("deep");
      });

      test("4-level nested key via resolve", () => {
        const ks = new KeySpec("a/b/c/d");
        const data = { a: { b: { c: { d: 99 } } } };
        expect(ks.resolve(data, true).value).toBe(99);
      });

      test("5-level nested key (general case) via resolve", () => {
        const ks = new KeySpec("a/b/c/d/e");
        const data = { a: { b: { c: { d: { e: "general" } } } } };
        expect(ks.resolve(data, true).value).toBe("general");
      });
    });

    describe("compiled getter — array indices", () => {
      test("array index via compiled getter", () => {
        const ks = new KeySpec("arr/#0");
        const data = { arr: [10, 20, 30] };
        expect(ks.resolve(data, true).value).toBe(10);
      });

      test("nested array then object", () => {
        const ks = new KeySpec("items/#1/name");
        const data = { items: [{ name: "a" }, { name: "b" }] };
        expect(ks.resolve(data, true).value).toBe("b");
      });
    });

    describe("compiled getter — resolveValue", () => {
      test("returns value directly for nested key", () => {
        const ks = new KeySpec("address/zip");
        const data = { address: { zip: "12345" } };
        expect(ks.resolveValue(data)).toBe("12345");
      });

      test("returns undefined for missing nested key", () => {
        const ks = new KeySpec("address/zip");
        const data = { address: { city: "NYC" } };
        expect(ks.resolveValue(data)).toBeUndefined();
      });

      test("returns undefined for missing intermediate", () => {
        const ks = new KeySpec("address/zip");
        const data: JsonObject = {};
        expect(ks.resolveValue(data)).toBeUndefined();
      });

      test("returns null value correctly", () => {
        const ks = new KeySpec("address/zip");
        const data = { address: { zip: null } };
        expect(ks.resolveValue(data)).toBeNull();
      });

      test("returns 0 value correctly", () => {
        const ks = new KeySpec("a/b");
        const data = { a: { b: 0 } };
        expect(ks.resolveValue(data)).toBe(0);
      });

      test("returns false value correctly", () => {
        const ks = new KeySpec("a/b");
        const data = { a: { b: false } };
        expect(ks.resolveValue(data)).toBe(false);
      });

      test("returns empty string correctly", () => {
        const ks = new KeySpec("a/b");
        const data = { a: { b: "" } };
        expect(ks.resolveValue(data)).toBe("");
      });

      test("throwError throws for missing key", () => {
        const ks = new KeySpec("a/b");
        expect(() => ks.resolveValue({}, true)).toThrow(NoSuchKeyError);
      });
    });

    describe("compiled getter — null intermediate", () => {
      test("returns not-found for null intermediate", () => {
        const ks = new KeySpec("address/zip");
        const data = { address: null };
        const result = ks.resolve(data, true);
        expect(result.found).toBe(false);
        expect(result.value).toBeUndefined();
      });

      test("returns not-found for missing top key", () => {
        const ks = new KeySpec("address/zip");
        const data: JsonObject = { other: 1 };
        const result = ks.resolve(data, true);
        expect(result.found).toBe(false);
      });
    });

    describe("compiled getter — fuzzy matching (lazy compile)", () => {
      test("fuzzy nested spec compiles after first resolution", () => {
        const data = { address: { zip: "12345" } };
        const ks = new KeySpec("@addr/zip");
        // First resolution triggers lazy compilation
        expect(ks.resolve(data, true).value).toBe("12345");
        // Second resolution uses compiled getter
        expect(ks.resolve(data, true).value).toBe("12345");
      });

      test("fuzzy single-key spec compiles after first resolution", () => {
        const data = { first_key: "foo", second_key: "bar" };
        // First call resolves via fuzzy matching and triggers lazy compilation
        expect(findKey(data, "@first")).toBe("foo");
        // Subsequent calls use compiled path
        expect(findKey(data, "@first")).toBe("foo");
      });
    });

    describe("compiled setter — setValue", () => {
      test("sets nested value via compiled setter", () => {
        const ks = new KeySpec("foo/bar");
        const data: JsonObject = { foo: { bar: 1 } };
        ks.setValue(data, 99);
        expect((data["foo"] as JsonObject)["bar"]).toBe(99);
      });

      test("sets deep nested value via compiled setter", () => {
        const ks = new KeySpec("a/b/c");
        const data: JsonObject = { a: { b: { c: 1 } } };
        ks.setValue(data, "new");
        expect(((data["a"] as JsonObject)["b"] as JsonObject)["c"]).toBe("new");
      });

      test("vivifies intermediate via compiled setter", () => {
        const ks = new KeySpec("a/b");
        const data: JsonObject = {};
        ks.setValue(data, 42);
        expect((data["a"] as JsonObject)["b"]).toBe(42);
      });

      test("vivifies array intermediate via compiled setter", () => {
        const ks = new KeySpec("a/#0");
        const data: JsonObject = {};
        ks.setValue(data, "first");
        expect((data["a"] as string[])[0]).toBe("first");
      });

      test("sets array element via compiled setter", () => {
        const ks = new KeySpec("arr/#1");
        const data: JsonObject = { arr: [10, 20, 30] };
        ks.setValue(data, 99);
        expect((data["arr"] as number[])[1]).toBe(99);
      });

      test("fuzzy setter compiles after first set", () => {
        const data: JsonObject = { address: { zip: "00000" } };
        const ks = new KeySpec("@addr/zip");
        // First set goes through slow path and compiles
        ks.setValue(data, "12345");
        expect((data["address"] as JsonObject)["zip"]).toBe("12345");
        // Second set uses compiled setter
        ks.setValue(data, "99999");
        expect((data["address"] as JsonObject)["zip"]).toBe("99999");
      });
    });

    describe("compiled vs original — consistency", () => {
      test("findKey with noVivify produces same results", () => {
        const data = {
          name: "Alice",
          address: { street: "123 Main", zip: "12345", coords: { lat: 40.7, lng: -74.0 } },
          tags: ["alpha", "beta"],
          items: [{ id: 1 }, { id: 2 }],
        };

        // All these go through compiled path
        expect(findKey(data, "address/zip", true)).toBe("12345");
        expect(findKey(data, "address/coords/lat", true)).toBe(40.7);
        expect(findKey(data, "tags/#0", true)).toBe("alpha");
        expect(findKey(data, "tags/#1", true)).toBe("beta");
        expect(findKey(data, "items/#0/id", true)).toBe(1);
        expect(findKey(data, "items/#1/id", true)).toBe(2);

        // Missing keys
        expect(findKey(data, "address/missing", true)).toBeUndefined();
        expect(findKey(data, "missing/key", true)).toBeUndefined();
        expect(findKey(data, "address/coords/missing", true)).toBeUndefined();
      });

      test("setKey with compiled setter produces same results", () => {
        const data1: JsonObject = { a: { b: { c: 1 } } };
        const data2: JsonObject = { a: { b: { c: 1 } } };

        setKey(data1, "a/b/c", 99);
        // Use a fresh KeySpec (uncached) for comparison
        clearKeySpecCaches();
        setKey(data2, "a/b/c", 99);

        expect(data1).toEqual(data2);
      });
    });
  });
});
