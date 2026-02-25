import { describe, test, expect } from "bun:test";
import { Record } from "../src/Record.ts";
import { Executor, transformCode } from "../src/Executor.ts";

describe("Executor", () => {
  describe("transformCode", () => {
    test("transforms {{key}} to accessor", () => {
      const result = transformCode("{{foo}}");
      expect(result).toBe('__F["foo"]');
    });

    test("transforms {{key/nested}} to accessor", () => {
      const result = transformCode("{{foo/bar}}");
      expect(result).toBe('__F["foo/bar"]');
    });

    test("preserves assignment — language handles it natively", () => {
      const result = transformCode("{{foo}} = 42");
      expect(result).toBe('__F["foo"] = 42');
    });

    test("handles multiple transforms", () => {
      const result = transformCode("{{a}} + {{b}}");
      expect(result).toBe('__F["a"] + __F["b"]');
    });

    test("preserves compound += — language handles it natively", () => {
      const result = transformCode("{{x}} += 2");
      expect(result).toBe('__F["x"] += 2');
    });

    test("preserves compound -= — language handles it natively", () => {
      const result = transformCode("{{x}} -= 1");
      expect(result).toBe('__F["x"] -= 1');
    });

    test("preserves compound *= — language handles it natively", () => {
      const result = transformCode("{{x}} *= 3");
      expect(result).toBe('__F["x"] *= 3');
    });

    test("preserves compound /= — language handles it natively", () => {
      const result = transformCode("{{x}} /= 2");
      expect(result).toBe('__F["x"] /= 2');
    });

    test("preserves compound **= — language handles it natively", () => {
      const result = transformCode("{{x}} **= 2");
      expect(result).toBe('__F["x"] **= 2');
    });

    test("preserves compound ||= — language handles it natively", () => {
      const result = transformCode("{{x}} ||= 5");
      expect(result).toBe('__F["x"] ||= 5');
    });

    test("preserves compound &&= — language handles it natively", () => {
      const result = transformCode("{{x}} &&= 5");
      expect(result).toBe('__F["x"] &&= 5');
    });

    test("preserves compound ??= — language handles it natively", () => {
      const result = transformCode("{{x}} ??= 5");
      expect(result).toBe('__F["x"] ??= 5');
    });

    test("preserves compound >>= — language handles it natively", () => {
      const result = transformCode("{{x}} >>= 1");
      expect(result).toBe('__F["x"] >>= 1');
    });

    test("preserves compound >>>= — language handles it natively", () => {
      const result = transformCode("{{x}} >>>= 1");
      expect(result).toBe('__F["x"] >>>= 1');
    });

    test("preserves compound <<= — language handles it natively", () => {
      const result = transformCode("{{x}} <<= 1");
      expect(result).toBe('__F["x"] <<= 1');
    });

    test("preserves compound |= — language handles it natively", () => {
      const result = transformCode("{{x}} |= 3");
      expect(result).toBe('__F["x"] |= 3');
    });

    test("preserves compound &= — language handles it natively", () => {
      const result = transformCode("{{x}} &= 3");
      expect(result).toBe('__F["x"] &= 3');
    });

    test("preserves compound ^= — language handles it natively", () => {
      const result = transformCode("{{x}} ^= 3");
      expect(result).toBe('__F["x"] ^= 3');
    });

    test("preserves compound //= — language handles it natively", () => {
      const result = transformCode("{{x}} //= 10");
      expect(result).toBe('__F["x"] //= 10');
    });

    test("preserves compound %= — language handles it natively", () => {
      const result = transformCode("{{x}} %= 3");
      expect(result).toBe('__F["x"] %= 3');
    });

    test("nested keyspec in compound assignment", () => {
      const result = transformCode("{{a/b}} += 1");
      expect(result).toBe('__F["a/b"] += 1');
    });

    test("lvalue style for Perl", () => {
      const result = transformCode("{{x}} += 1", "lvalue");
      expect(result).toBe('_f("x") += 1');
    });

    test("lvalue style for Perl simple assign", () => {
      const result = transformCode("{{x}} = 5", "lvalue");
      expect(result).toBe('_f("x") = 5');
    });

    test("lvalue style for Perl read", () => {
      const result = transformCode("{{x}}", "lvalue");
      expect(result).toBe('_f("x")');
    });

    test("== is preserved correctly (no special handling needed)", () => {
      const result = transformCode("{{x}} == 5");
      expect(result).toBe('__F["x"] == 5');
      expect(result).not.toContain("__set");
    });

    test("=== is preserved correctly (no special handling needed)", () => {
      const result = transformCode("{{x}} === 5");
      expect(result).toBe('__F["x"] === 5');
    });

    // --- Regression tests for bugs fixed by lvalue approach ---

    test("assignment with function call containing commas in RHS", () => {
      // Old regex approach broke on commas: [^;,\\n]+ stopped at the comma
      const result = transformCode("{{x}} = foo(a, b)");
      expect(result).toBe('__F["x"] = foo(a, b)');
    });

    test("assignment with array literal in RHS", () => {
      const result = transformCode("{{x}} = [1, 2, 3]");
      expect(result).toBe('__F["x"] = [1, 2, 3]');
    });

    test("assignment with object literal in RHS", () => {
      const result = transformCode("{{x}} = {a: 1, b: 2}");
      expect(result).toBe('__F["x"] = {a: 1, b: 2}');
    });

    test("assignment with ternary in RHS", () => {
      const result = transformCode("{{x}} = a > b ? c : d");
      expect(result).toBe('__F["x"] = a > b ? c : d');
    });

    test("compound assignment with function call in RHS", () => {
      const result = transformCode("{{x}} += Math.max(a, b)");
      expect(result).toBe('__F["x"] += Math.max(a, b)');
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
      const data = record.dataRef();
      expect(data["new_field"]).toBe("created");
    });

    test("evaluates {{}} compound assignment +=", () => {
      const executor = new Executor("{{x}} += 10");
      const record = new Record({ x: 5 });
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toBe(15);
    });

    test("evaluates {{}} compound assignment -=", () => {
      const executor = new Executor("{{x}} -= 3");
      const record = new Record({ x: 10 });
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toBe(7);
    });

    test("evaluates {{}} compound assignment *=", () => {
      const executor = new Executor("{{x}} *= 4");
      const record = new Record({ x: 3 });
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toBe(12);
    });

    test("evaluates {{}} compound assignment **=", () => {
      const executor = new Executor("{{x}} **= 3");
      const record = new Record({ x: 2 });
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toBe(8);
    });

    // --- Regression tests: bugs that existed with the old regex approach ---

    test("assignment with function call containing commas", () => {
      const executor = new Executor("{{x}} = Math.max(3, 7)");
      const record = new Record({ x: 0 });
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toBe(7);
    });

    test("compound assignment with function call containing commas", () => {
      const executor = new Executor("{{x}} += Math.min(10, 20)");
      const record = new Record({ x: 5 });
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toBe(15);
    });

    test("assignment with array literal", () => {
      const executor = new Executor("{{x}} = [1, 2, 3]");
      const record = new Record({});
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toEqual([1, 2, 3]);
    });

    test("assignment with object literal", () => {
      const executor = new Executor("{{x}} = {a: 1, b: 2}");
      const record = new Record({});
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toEqual({ a: 1, b: 2 });
    });

    test("assignment with ternary operator", () => {
      const executor = new Executor("{{x}} = {{y}} > 5 ? 'big' : 'small'");
      const r1 = new Record({ y: 10 });
      executor.executeCode(r1);
      expect(r1.dataRef()["x"]).toBe("big");

      const r2 = new Record({ y: 2 });
      executor.executeCode(r2);
      expect(r2.dataRef()["x"]).toBe("small");
    });

    test("increment operator ++", () => {
      const executor = new Executor("{{x}}++");
      const record = new Record({ x: 5 });
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toBe(6);
    });

    test("decrement operator --", () => {
      const executor = new Executor("{{x}}--");
      const record = new Record({ x: 5 });
      executor.executeCode(record);
      expect(record.dataRef()["x"]).toBe(4);
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

  describe("persistent state across records", () => {
    test("state object persists across executeCode calls", () => {
      const executor = new Executor("state.count = (state.count || 0) + 1; return state.count");
      const r = new Record({});
      expect(executor.executeCode(r)).toBe(1);
      expect(executor.executeCode(r)).toBe(2);
      expect(executor.executeCode(r)).toBe(3);
    });

    test("state accumulates values across records", () => {
      const executor = new Executor(
        "state.sum = (state.sum || 0) + r.get('val'); return state.sum"
      );
      expect(executor.executeCode(new Record({ val: 10 }))).toBe(10);
      expect(executor.executeCode(new Record({ val: 20 }))).toBe(30);
      expect(executor.executeCode(new Record({ val: 5 }))).toBe(35);
    });

    test("state is shared across named snippets in same executor", () => {
      const executor = new Executor({
        inc: {
          code: "state.n = (state.n || 0) + 1; return state.n",
          argNames: ["r"],
        },
        get: {
          code: "return state.n || 0",
          argNames: ["r"],
        },
      });
      const r = new Record({});
      expect(executor.executeMethod("get", r)).toBe(0);
      executor.executeMethod("inc", r);
      executor.executeMethod("inc", r);
      expect(executor.executeMethod("get", r)).toBe(2);
    });

    test("state can store arrays and objects", () => {
      const executor = new Executor(
        "if (!state.items) state.items = []; state.items.push(r.get('name')); return state.items"
      );
      executor.executeCode(new Record({ name: "a" }));
      executor.executeCode(new Record({ name: "b" }));
      const result = executor.executeCode(new Record({ name: "c" }));
      expect(result).toEqual(["a", "b", "c"]);
    });
  });

  describe("error handling", () => {
    test("throws on invalid code", () => {
      expect(() => new Executor("this is not valid {{{ javascript")).toThrow();
    });
  });
});
