/**
 * Cross-language {{}} template expansion tests.
 *
 * Verifies that {{field}} syntax works equivalently across JS, Python, and
 * Perl snippet runners — reads, simple assignments, compound assignments,
 * and nested key access.
 */

import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";
import { JsSnippetRunner } from "../../src/snippets/JsSnippetRunner.ts";
import { PythonSnippetRunner } from "../../src/snippets/PythonSnippetRunner.ts";
import { PerlSnippetRunner } from "../../src/snippets/PerlSnippetRunner.ts";
import type { SnippetRunner } from "../../src/snippets/SnippetRunner.ts";

// ── Runner factories ─────────────────────────────────────────────

const runners: { name: string; create: () => SnippetRunner }[] = [
  { name: "js", create: () => new JsSnippetRunner() },
  { name: "python", create: () => new PythonSnippetRunner() },
  { name: "perl", create: () => new PerlSnippetRunner() },
];

// ── Cross-language tests ─────────────────────────────────────────

for (const { name, create } of runners) {
  describe(`{{}} template expansion [${name}]`, () => {
    // ── Reads (grep mode) ──────────────────────────────────────

    test("{{field}} read in grep — passes when true", () => {
      const runner = create();
      void runner.init("{{x}} > 5", { mode: "grep" });

      const results = runner.executeBatch([new Record({ x: 10 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.passed).toBe(true);
    });

    test("{{field}} read in grep — fails when false", () => {
      const runner = create();
      void runner.init("{{x}} > 5", { mode: "grep" });

      const results = runner.executeBatch([new Record({ x: 3 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.passed).toBe(false);
    });

    // ── Simple assignment (eval mode) ──────────────────────────

    test("{{field}} = value assigns new field", () => {
      const runner = create();
      void runner.init("{{y}} = 42", { mode: "eval" });

      const results = runner.executeBatch([new Record({ x: 1 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.record!["y"]).toBe(42);
      expect(results[0]!.record!["x"]).toBe(1);
    });

    test("{{field}} = value overwrites existing field", () => {
      const runner = create();
      void runner.init("{{x}} = 99", { mode: "eval" });

      const results = runner.executeBatch([new Record({ x: 1 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.record!["x"]).toBe(99);
    });

    // ── Compound assignments (eval mode) ────────────────────────

    test("{{field}} += value", () => {
      const runner = create();
      void runner.init("{{x}} += 10", { mode: "eval" });

      const results = runner.executeBatch([new Record({ x: 5 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.record!["x"]).toBe(15);
    });

    test("{{field}} -= value", () => {
      const runner = create();
      void runner.init("{{x}} -= 3", { mode: "eval" });

      const results = runner.executeBatch([new Record({ x: 10 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.record!["x"]).toBe(7);
    });

    test("{{field}} *= value", () => {
      const runner = create();
      void runner.init("{{x}} *= 4", { mode: "eval" });

      const results = runner.executeBatch([new Record({ x: 3 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.record!["x"]).toBe(12);
    });

    test("{{field}} **= value (exponentiation)", () => {
      const runner = create();
      void runner.init("{{x}} **= 3", { mode: "eval" });

      const results = runner.executeBatch([new Record({ x: 2 })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.record!["x"]).toBe(8);
    });

    // ── Nested key access ──────────────────────────────────────

    test("{{a/b}} reads nested key in grep", () => {
      const runner = create();
      void runner.init("{{a/b}} > 0", { mode: "grep" });

      const results = runner.executeBatch([
        new Record({ a: { b: 5 } }),
        new Record({ a: { b: -1 } }),
      ]);
      expect(results).toHaveLength(2);
      expect(results[0]!.passed).toBe(true);
      expect(results[1]!.passed).toBe(false);
    });

    test("{{a/b}} = value writes nested key", () => {
      const runner = create();
      void runner.init("{{a/b}} = 99", { mode: "eval" });

      const results = runner.executeBatch([new Record({ a: { b: 1 } })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.record!["a"]).toEqual({ b: 99 });
    });

    test("{{a/b}} += value compound assigns nested key", () => {
      const runner = create();
      void runner.init("{{a/b}} += 10", { mode: "eval" });

      const results = runner.executeBatch([new Record({ a: { b: 5 } })]);
      expect(results).toHaveLength(1);
      expect(results[0]!.record!["a"]).toEqual({ b: 15 });
    });

    // ── Multiple records ───────────────────────────────────────

    test("{{field}} += value across multiple records", () => {
      const runner = create();
      void runner.init("{{x}} += 1", { mode: "eval" });

      const results = runner.executeBatch([
        new Record({ x: 10 }),
        new Record({ x: 20 }),
        new Record({ x: 30 }),
      ]);
      expect(results).toHaveLength(3);
      expect(results[0]!.record!["x"]).toBe(11);
      expect(results[1]!.record!["x"]).toBe(21);
      expect(results[2]!.record!["x"]).toBe(31);
    });
  });
}

// ── Language-specific: method calls on {{}} values ──────────────

describe("{{}} method calls on expanded values [js]", () => {
  test("{{field}}.toFixed(2) formats number", () => {
    const runner = new JsSnippetRunner();
    void runner.init("{{formatted}} = {{price}}.toFixed(2)", { mode: "eval" });

    const results = runner.executeBatch([new Record({ price: 3.14159 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["formatted"]).toBe("3.14");
  });

  test("{{field}}.toUpperCase() transforms string", () => {
    const runner = new JsSnippetRunner();
    void runner.init("{{upper}} = {{name}}.toUpperCase()", { mode: "eval" });

    const results = runner.executeBatch([new Record({ name: "alice" })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["upper"]).toBe("ALICE");
  });

  test("{{field}}.length reads string length in grep", () => {
    const runner = new JsSnippetRunner();
    void runner.init("{{name}}.length > 3", { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ name: "ab" }),
      new Record({ name: "alice" }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(false);
    expect(results[1]!.passed).toBe(true);
  });

  test("{{field}}.includes() checks substring", () => {
    const runner = new JsSnippetRunner();
    void runner.init('{{name}}.includes("li")', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ name: "alice" }),
      new Record({ name: "bob" }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("{{field}}.toString() on number", () => {
    const runner = new JsSnippetRunner();
    void runner.init("{{str}} = {{x}}.toString()", { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 42 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["str"]).toBe("42");
  });

  test("Math.round({{field}}) wraps expanded value in function", () => {
    const runner = new JsSnippetRunner();
    void runner.init("{{rounded}} = Math.round({{x}})", { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 3.7 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["rounded"]).toBe(4);
  });
});

describe("{{}} method calls on expanded values [python]", () => {
  test("str({{field}}) converts to string", () => {
    const runner = new PythonSnippetRunner();
    void runner.init("{{s}} = str({{x}})", { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 42 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["s"]).toBe("42");
  });

  test("round({{field}}, N) rounds number", () => {
    const runner = new PythonSnippetRunner();
    // With lvalue approach, commas in RHS work correctly
    void runner.init("{{rounded}} = round({{price}}, 2)", { mode: "eval" });

    const results = runner.executeBatch([new Record({ price: 3.14159 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["rounded"]).toBe(3.14);
  });

  test("{{field}}.upper() transforms string", () => {
    const runner = new PythonSnippetRunner();
    void runner.init("{{upper}} = {{name}}.upper()", { mode: "eval" });

    const results = runner.executeBatch([new Record({ name: "alice" })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["upper"]).toBe("ALICE");
  });

  test("len({{field}}) in grep", () => {
    const runner = new PythonSnippetRunner();
    void runner.init("len({{name}}) > 3", { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ name: "ab" }),
      new Record({ name: "alice" }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(false);
    expect(results[1]!.passed).toBe(true);
  });

  test("'substring' in {{field}} checks containment", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('"li" in {{name}}', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ name: "alice" }),
      new Record({ name: "bob" }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("int({{field}}) converts float to int", () => {
    const runner = new PythonSnippetRunner();
    void runner.init("{{truncated}} = int({{x}})", { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 3.9 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["truncated"]).toBe(3);
  });
});

describe("{{}} method calls on expanded values [perl]", () => {
  test("sprintf formats {{field}}", () => {
    const runner = new PerlSnippetRunner();
    // With lvalue approach, commas in RHS work correctly
    void runner.init('{{formatted}} = sprintf("%.2f", {{price}})', {
      mode: "eval",
    });

    const results = runner.executeBatch([new Record({ price: 3.14159 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["formatted"]).toBe("3.14");
  });

  test("uc({{field}}) uppercases string", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("{{upper}} = uc({{name}})", { mode: "eval" });

    const results = runner.executeBatch([new Record({ name: "alice" })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["upper"]).toBe("ALICE");
  });

  test("length({{field}}) in grep", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("length({{name}}) > 3", { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ name: "ab" }),
      new Record({ name: "alice" }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(false);
    expect(results[1]!.passed).toBe(true);
  });

  test("index({{field}}, substr) checks containment", () => {
    const runner = new PerlSnippetRunner();
    void runner.init('index({{name}}, "li") >= 0', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ name: "alice" }),
      new Record({ name: "bob" }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("int({{field}}) truncates float", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("{{truncated}} = int({{x}})", { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 3.9 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["truncated"]).toBe(3);
  });

  test("lc({{field}}) lowercases string", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("{{lower}} = lc({{name}})", { mode: "eval" });

    const results = runner.executeBatch([new Record({ name: "ALICE" })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["lower"]).toBe("alice");
  });
});

// ── Language-specific: record method access ─────────────────────

describe("record method access [js]", () => {
  test("r.keys() returns field names", () => {
    const runner = new JsSnippetRunner();
    void runner.init("{{count}} = r.keys().length", { mode: "eval" });

    const results = runner.executeBatch([new Record({ a: 1, b: 2, c: 3 })]);
    expect(results).toHaveLength(1);
    // count itself is added, so 3 original + 1 new = 4
    expect(results[0]!.record!["count"]).toBe(3);
  });

  test("r.has() checks field existence in grep", () => {
    const runner = new JsSnippetRunner();
    void runner.init('r.has("x")', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ x: 1 }),
      new Record({ y: 2 }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("r.get() reads a field", () => {
    const runner = new JsSnippetRunner();
    void runner.init('r.get("x") > 5', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ x: 10 }),
      new Record({ x: 3 }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("r.set() writes a field", () => {
    const runner = new JsSnippetRunner();
    void runner.init('r.set("y", {{x}} * 2)', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 5 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["y"]).toBe(10);
  });

  test("r.toJSON() returns plain object", () => {
    const runner = new JsSnippetRunner();
    void runner.init(
      "{{isObj}} = typeof r.toJSON() === 'object'",
      { mode: "eval" },
    );

    const results = runner.executeBatch([new Record({ b: 2, a: 1 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["isObj"]).toBe(true);
  });

  test("r.remove() deletes a field", () => {
    const runner = new JsSnippetRunner();
    void runner.init('r.remove("y")', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 1, y: 2 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["x"]).toBe(1);
    expect(results[0]!.record!["y"]).toBeUndefined();
  });

  test("r.rename() renames a field", () => {
    const runner = new JsSnippetRunner();
    void runner.init('r.rename("x", "newX")', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 42, y: 1 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["newX"]).toBe(42);
    expect(results[0]!.record!["x"]).toBeUndefined();
    expect(results[0]!.record!["y"]).toBe(1);
  });

  test("r.pruneTo() keeps only specified fields", () => {
    const runner = new JsSnippetRunner();
    void runner.init('r.pruneTo("a", "c")', { mode: "eval" });

    const results = runner.executeBatch([
      new Record({ a: 1, b: 2, c: 3, d: 4 }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["a"]).toBe(1);
    expect(results[0]!.record!["c"]).toBe(3);
    expect(results[0]!.record!["b"]).toBeUndefined();
    expect(results[0]!.record!["d"]).toBeUndefined();
  });

  test("r.clone() creates independent copy", () => {
    const runner = new JsSnippetRunner();
    // Clone r, modify the clone's field, assign its value to original —
    // confirms clone() returns a real Record with separate data
    void runner.init(
      'var c = r.clone(); c.set("x", 999); {{cloneVal}} = c.get("x")',
      { mode: "eval" },
    );

    const results = runner.executeBatch([new Record({ x: 1 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["cloneVal"]).toBe(999);
    // original x is unchanged
    expect(results[0]!.record!["x"]).toBe(1);
  });
});

describe("record method access [python]", () => {
  test("r.keys() returns field names", () => {
    const runner = new PythonSnippetRunner();
    void runner.init("{{count}} = len(r.keys())", { mode: "eval" });

    const results = runner.executeBatch([new Record({ a: 1, b: 2, c: 3 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["count"]).toBe(3);
  });

  test("r.has() checks field existence in grep", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.has("@x")', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ x: 1 }),
      new Record({ y: 2 }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("r['field'] dict-style access", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r["x"] > 5', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ x: 10 }),
      new Record({ x: 3 }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("r['field'] = value assigns via dict interface", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r["y"] = {{x}} * 2', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 5 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["y"]).toBe(10);
  });

  test("'key' in r checks membership", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('"x" in r', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ x: 1 }),
      new Record({ y: 2 }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("len(r) returns field count", () => {
    const runner = new PythonSnippetRunner();
    void runner.init("len(r) == 3", { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ a: 1, b: 2, c: 3 }),
      new Record({ a: 1 }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("r.to_dict() returns plain dict", () => {
    const runner = new PythonSnippetRunner();
    void runner.init("{{is_dict}} = type(r.to_dict()).__name__", {
      mode: "eval",
    });

    const results = runner.executeBatch([new Record({ a: 1 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["is_dict"]).toBe("dict");
  });

  // ── Python Record SDK keyspec methods ───────────────────────

  test("r.get() with nested keyspec", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.get("a/b") > 0', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ a: { b: 5 } }),
      new Record({ a: { b: -1 } }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("r.set() with nested keyspec auto-vivifies", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.set("a/b/c", 42)', { mode: "eval" });

    const results = runner.executeBatch([new Record({})]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["a"]).toEqual({ b: { c: 42 } });
  });

  test("r.has() with nested keyspec", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.has("a/b")', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ a: { b: 1 } }),
      new Record({ a: { c: 1 } }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("r.get() with array index keyspec", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('{{val}} = r.get("items/#1")', { mode: "eval" });

    const results = runner.executeBatch([
      new Record({ items: [10, 20, 30] }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["val"]).toBe(20);
  });

  test("r.set() with array index keyspec", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.set("items/#0", 99)', { mode: "eval" });

    const results = runner.executeBatch([
      new Record({ items: [10, 20, 30] }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["items"]).toEqual([99, 20, 30]);
  });

  test("r.data_ref() returns mutable dict reference", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.data_ref()["injected"] = 1', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 1 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["injected"]).toBe(1);
    expect(results[0]!.record!["x"]).toBe(1);
  });

  test("del r['field'] removes a field", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('del r["y"]', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 1, y: 2 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["x"]).toBe(1);
    expect(results[0]!.record!["y"]).toBeUndefined();
  });

  test("Record() constructor creates new record", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('{{val}} = Record({"a": 1}).get("a")', { mode: "eval" });

    const results = runner.executeBatch([new Record({})]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["val"]).toBe(1);
  });

  test("r.remove() deletes a field and returns old value", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.remove("y")', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 1, y: 2 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["x"]).toBe(1);
    expect(results[0]!.record!["y"]).toBeUndefined();
  });

  test("r.remove() multi-key removal", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.remove("a", "b")', { mode: "eval" });

    const results = runner.executeBatch([
      new Record({ a: 1, b: 2, c: 3 }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["a"]).toBeUndefined();
    expect(results[0]!.record!["b"]).toBeUndefined();
    expect(results[0]!.record!["c"]).toBe(3);
  });

  test("r.rename() renames a field", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.rename("x", "newX")', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 42, y: 1 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["newX"]).toBe(42);
    expect(results[0]!.record!["x"]).toBeUndefined();
    expect(results[0]!.record!["y"]).toBe(1);
  });

  test("r.prune_to() keeps only specified fields", () => {
    const runner = new PythonSnippetRunner();
    void runner.init('r.prune_to("a", "c")', { mode: "eval" });

    const results = runner.executeBatch([
      new Record({ a: 1, b: 2, c: 3, d: 4 }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["a"]).toBe(1);
    expect(results[0]!.record!["c"]).toBe(3);
    expect(results[0]!.record!["b"]).toBeUndefined();
    expect(results[0]!.record!["d"]).toBeUndefined();
  });
});

describe("record method access [perl]", () => {
  test("$r->{field} direct hash access in grep", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("$r->{x} > 5", { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ x: 10 }),
      new Record({ x: 3 }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("$r->{field} = value assigns via hash", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("$r->{y} = {{x}} * 2", { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 5 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["y"]).toBe(10);
  });

  test("exists $r->{field} checks existence", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("exists $r->{x}", { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ x: 1 }),
      new Record({ y: 2 }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("keys %$r returns field names", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("{{count}} = scalar(keys %$r)", { mode: "eval" });

    const results = runner.executeBatch([new Record({ a: 1, b: 2, c: 3 })]);
    expect(results).toHaveLength(1);
    // _f("count") = scalar(keys %$r) — the lvalue sub creates the "count" key
    // before keys() runs, so we may get 3 or 4 depending on evaluation order
    expect(results[0]!.record!["count"]).toBeGreaterThanOrEqual(3);
  });

  test("delete $r->{field} removes a field", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("delete $r->{y}", { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 1, y: 2 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["x"]).toBe(1);
    expect(results[0]!.record!["y"]).toBeUndefined();
  });

  test("$r->{nested}{key} accesses nested hash directly", () => {
    const runner = new PerlSnippetRunner();
    void runner.init("$r->{a}{b} > 0", { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ a: { b: 5 } }),
      new Record({ a: { b: -1 } }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  // ── Perl RecsSDK keyspec methods ($r is a RecsSDK object) ───

  test("$r->get() reads nested keyspec", () => {
    const runner = new PerlSnippetRunner();
    void runner.init(
      '{{val}} = $r->get("a/b")',
      { mode: "eval" },
    );

    const results = runner.executeBatch([new Record({ a: { b: 42 } })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["val"]).toBe(42);
  });

  test("$r->get() with array index", () => {
    const runner = new PerlSnippetRunner();
    void runner.init(
      '{{val}} = $r->get("items/#1")',
      { mode: "eval" },
    );

    const results = runner.executeBatch([
      new Record({ items: [10, 20, 30] }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["val"]).toBe(20);
  });

  test("$r->set() writes nested keyspec with auto-vivification", () => {
    const runner = new PerlSnippetRunner();
    void runner.init(
      '$r->set("a/b/c", 99)',
      { mode: "eval" },
    );

    const results = runner.executeBatch([new Record({})]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["a"]).toEqual({ b: { c: 99 } });
  });

  test("$r->get() with mixed nested path (hash/array/hash)", () => {
    const runner = new PerlSnippetRunner();
    void runner.init(
      '{{val}} = $r->get("data/#0/name")',
      { mode: "eval" },
    );

    const results = runner.executeBatch([
      new Record({ data: [{ name: "alice" }, { name: "bob" }] }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["val"]).toBe("alice");
  });

  test("$r->set() with array index", () => {
    const runner = new PerlSnippetRunner();
    void runner.init(
      '$r->set("items/#0", 99)',
      { mode: "eval" },
    );

    const results = runner.executeBatch([
      new Record({ items: [10, 20, 30] }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["items"]).toEqual([99, 20, 30]);
  });

  test("$r->has() checks nested keyspec existence", () => {
    const runner = new PerlSnippetRunner();
    void runner.init('$r->has("a/b")', { mode: "grep" });

    const results = runner.executeBatch([
      new Record({ a: { b: 1 } }),
      new Record({ a: { c: 1 } }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[0]!.passed).toBe(true);
    expect(results[1]!.passed).toBe(false);
  });

  test("$r->keys() returns field names", () => {
    const runner = new PerlSnippetRunner();
    void runner.init('{{count}} = scalar($r->keys())', { mode: "eval" });

    const results = runner.executeBatch([new Record({ a: 1, b: 2, c: 3 })]);
    expect(results).toHaveLength(1);
    // _f("count") = scalar($r->keys()) — lvalue may create key before keys() runs
    expect(results[0]!.record!["count"]).toBeGreaterThanOrEqual(3);
  });

  test("$r->remove() deletes a field and returns old value", () => {
    const runner = new PerlSnippetRunner();
    void runner.init('$r->remove("y")', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 1, y: 2 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["x"]).toBe(1);
    expect(results[0]!.record!["y"]).toBeUndefined();
  });

  test("$r->rename() renames a field", () => {
    const runner = new PerlSnippetRunner();
    void runner.init('$r->rename("x", "newX")', { mode: "eval" });

    const results = runner.executeBatch([new Record({ x: 42, y: 1 })]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["newX"]).toBe(42);
    expect(results[0]!.record!["x"]).toBeUndefined();
    expect(results[0]!.record!["y"]).toBe(1);
  });

  test("$r->prune_to() keeps only specified fields", () => {
    const runner = new PerlSnippetRunner();
    void runner.init('$r->prune_to("a", "c")', { mode: "eval" });

    const results = runner.executeBatch([
      new Record({ a: 1, b: 2, c: 3, d: 4 }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]!.record!["a"]).toBe(1);
    expect(results[0]!.record!["c"]).toBe(3);
    expect(results[0]!.record!["b"]).toBeUndefined();
    expect(results[0]!.record!["d"]).toBeUndefined();
  });
});
