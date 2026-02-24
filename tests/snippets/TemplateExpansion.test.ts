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
