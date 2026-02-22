import { describe, test, expect } from "bun:test";
import { KeyGroups } from "../src/KeyGroups.ts";

describe("KeyGroups", () => {
  describe("Group parsing", () => {
    test("parses regex + option", () => {
      const kg = new KeyGroups("!foo!f");
      const fields = kg.getKeyspecsForRecord({ foo_bar: 1, baz: 2 });
      expect(fields).toContain("foo_bar");
    });

    test("parses regex with no options", () => {
      const kg = new KeyGroups("!foo!");
      const fields = kg.getKeyspecsForRecord({ foo_bar: 1 });
      expect(fields).toContain("foo_bar");
    });

    test("parses regex with option value", () => {
      const kg = new KeyGroups("!foo!d=3");
      // Just test it parses without error
      expect(kg.hasAnyGroup()).toBe(true);
    });

    test("parses regex with multiple options", () => {
      const kg = new KeyGroups("!foo!d=3!f");
      expect(kg.hasAnyGroup()).toBe(true);
    });
  });

  describe("Group field matching", () => {
    test("finds prefix matches", () => {
      const kg = new KeyGroups("!^zip!");
      const rec = { zip_foo: "1", zip_bar: 2, foo_bar: 3 };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip_bar", "zip_foo"]);
    });

    test("excludes hash values by default", () => {
      const kg = new KeyGroups("!^zip!");
      const rec = { zip_foo: "1", zip_bar: 2, zip: { foo: 1 } };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip_bar", "zip_foo"]);
    });

    test("excludes array values by default", () => {
      const kg = new KeyGroups("!^zip!");
      const rec = { zip_foo: "1", zip_bar: 2, zip: [1] };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip_bar", "zip_foo"]);
    });

    test("full match finds nested keys", () => {
      const kg = new KeyGroups("!zip!f");
      const rec = { zip_foo: "1", zip_bar: 2, zip: { foo: 1 } };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip/foo", "zip_bar", "zip_foo"]);
    });

    test("full match on second and first level", () => {
      const kg = new KeyGroups("!foo!f");
      const rec = { zip_foo: "1", zip_bar: 2, zip: { foo: 1 } };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip/foo", "zip_foo"]);
    });

    test("depth option limits matching depth", () => {
      const kg = new KeyGroups("!foo!d=2");
      const rec = { zip_foo: "1", zip_bar: 2, zip: { foo: 1 } };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip/foo", "zip_foo"]);
    });

    test("returnrefs includes reference values", () => {
      const kg = new KeyGroups("!zip!rr");
      const rec = { zip_foo: "1", zip_bar: 2, zip: { foo: 1 } };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip", "zip_bar", "zip_foo"]);
    });

    test("returnrefs + full finds all", () => {
      const kg = new KeyGroups("!zip!rr!f");
      const rec = { zip_foo: "1", zip_bar: 2, zip: { foo: 1 } };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip", "zip/foo", "zip_bar", "zip_foo"]);
    });
  });

  describe("Group parsing errors", () => {
    test("error on missing ending !", () => {
      expect(() => new KeyGroups("!foo")).toThrow("Malformed group spec");
    });

    test("error on bad option", () => {
      expect(() => new KeyGroups("!foo!blah")).toThrow("Malformed group spec");
    });

    test("non-! prefix is treated as plain key spec", () => {
      // Without leading !, specs are treated as key specs, not group regex
      // "foo!" becomes a plain key spec lookup for "foo!"
      const kg = new KeyGroups("foo!");
      expect(kg.hasAnyGroup()).toBe(true);
    });

    test("plain key spec without !", () => {
      const kg = new KeyGroups("foo");
      expect(kg.hasAnyGroup()).toBe(true);
    });
  });

  describe("KeyGroups with multiple groups", () => {
    test("basic keygroup specification from constructor", () => {
      const kg = new KeyGroups("!foo!", "!bar!f");
      expect(kg.hasAnyGroup()).toBe(true);
    });

    test("find with 2 keygroups", () => {
      const kg = new KeyGroups("!foo!", "!bar!f");
      const rec = { zip_foo: "1", zip_bar: 2, zip: { foo: 1 } };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip_bar", "zip_foo"]);
    });

    test("find with 2 keygroups, one a keyspec", () => {
      const kg = new KeyGroups("@zip/f", "!bar!f");
      const rec = { zip_foo: "1", zip_bar: 2, zip: { foo: 1 } };
      const fields = kg.getKeyspecsForRecord(rec);
      expect(fields.sort()).toEqual(["zip/foo", "zip_bar"]);
    });

    test("multiple keygroups in one string (comma-separated)", () => {
      const kg = new KeyGroups("!foo!,!bar!f");
      expect(kg.hasAnyGroup()).toBe(true);
    });

    test("has_any_group with groups", () => {
      const kg = new KeyGroups("!foo!");
      expect(kg.hasAnyGroup()).toBe(true);
    });

    test("has_any_group with no groups", () => {
      const kg = new KeyGroups();
      expect(kg.hasAnyGroup()).toBe(false);
    });
  });

  describe("caching", () => {
    test("get_keyspecs caches results", () => {
      const kg = new KeyGroups("!foo!");
      const rec = { foo_bar: 1, baz: 2 };
      const first = kg.getKeyspecs(rec);
      const second = kg.getKeyspecs(rec);
      // Same array reference because of caching
      expect(first).toBe(second);
    });

    test("get_keyspecs_for_record always recomputes", () => {
      const kg = new KeyGroups("!foo!");
      const rec = { foo_bar: 1, baz: 2 };
      const first = kg.getKeyspecsForRecord(rec);
      const second = kg.getKeyspecsForRecord(rec);
      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });
  });
});
