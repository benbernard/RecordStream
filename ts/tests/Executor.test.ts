import { describe, test, expect } from "bun:test";
import { Record } from "../src/Record.ts";
import { Executor, transformCode } from "../src/Executor.ts";

describe("Executor", () => {
  describe("transformCode", () => {
    test("transforms {{key}} to __get call", () => {
      const result = transformCode("{{foo}}");
      expect(result).toContain("__get(r,");
      expect(result).toContain('"foo"');
    });

    test("transforms {{key/nested}} to __get call", () => {
      const result = transformCode("{{foo/bar}}");
      expect(result).toContain("__get(r,");
      expect(result).toContain('"foo/bar"');
    });

    test("transforms {{key}} = value to __set call", () => {
      const result = transformCode("{{foo}} = 42");
      expect(result).toContain("__set(r,");
      expect(result).toContain('"foo"');
      expect(result).toContain("42");
    });

    test("handles multiple transforms", () => {
      const result = transformCode("{{a}} + {{b}}");
      expect(result).toContain('"a"');
      expect(result).toContain('"b"');
    });
  });

  describe("executeCode", () => {
    test("evaluates simple expression on record", () => {
      const executor = new Executor("return r.get('x')");
      const record = new Record({ x: 42 });
      const result = executor.executeCode(record);
      expect(result).toBe(42);
    });

    test("evaluates {{}} syntax for reading", () => {
      const executor = new Executor("return {{foo}}");
      const record = new Record({ foo_bar: "hello" });
      const result = executor.executeCode(record);
      expect(result).toBe("hello");
    });

    test("evaluates {{}} syntax for nested access", () => {
      const executor = new Executor("return {{nested/val}}");
      const record = new Record({ nested: { val: 99 } });
      const result = executor.executeCode(record);
      expect(result).toBe(99);
    });

    test("evaluates {{}} syntax for writing", () => {
      const executor = new Executor("{{new_field}} = 'created'");
      const record = new Record({ x: 1 });
      executor.executeCode(record);
      // The fuzzy matching with @ prefix on "new_field" won't match any existing key,
      // so it'll create a new one
      const data = record.dataRef();
      expect(data["new_field"]).toBe("created");
    });

    test("provides $line counter", () => {
      const executor = new Executor("return $line");
      const r = new Record({});
      expect(executor.executeCode(r)).toBe(1);
      expect(executor.executeCode(r)).toBe(2);
      expect(executor.executeCode(r)).toBe(3);
    });

    test("provides $filename", () => {
      const executor = new Executor("return $filename");
      executor.setCurrentFilename("test.json");
      const r = new Record({});
      expect(executor.executeCode(r)).toBe("test.json");
    });
  });

  describe("named snippets", () => {
    test("executes named snippet", () => {
      const executor = new Executor({
        add: {
          code: "return a + b",
          argNames: ["a", "b"],
        },
      });
      const result = executor.executeMethod("add", 3, 4);
      expect(result).toBe(7);
    });

    test("throws on missing snippet", () => {
      const executor = new Executor("return 1");
      expect(() => executor.executeMethod("nonexistent")).toThrow(
        "No such snippet"
      );
    });
  });

  describe("error handling", () => {
    test("throws on invalid code", () => {
      expect(() => new Executor("this is not valid {{{ javascript")).toThrow();
    });
  });
});
