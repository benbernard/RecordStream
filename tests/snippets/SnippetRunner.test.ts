import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";
import { JsSnippetRunner } from "../../src/snippets/JsSnippetRunner.ts";
import { createSnippetRunner, isJsLang } from "../../src/snippets/index.ts";

describe("isJsLang", () => {
  test("recognizes JS variants", () => {
    expect(isJsLang("js")).toBe(true);
    expect(isJsLang("javascript")).toBe(true);
    expect(isJsLang("ts")).toBe(true);
    expect(isJsLang("typescript")).toBe(true);
    expect(isJsLang("JS")).toBe(true);
    expect(isJsLang("JavaScript")).toBe(true);
  });

  test("rejects non-JS languages", () => {
    expect(isJsLang("python")).toBe(false);
    expect(isJsLang("perl")).toBe(false);
    expect(isJsLang("py")).toBe(false);
  });
});

describe("createSnippetRunner", () => {
  test("creates JS runner", () => {
    const runner = createSnippetRunner("js");
    expect(runner.name).toBe("javascript");
  });

  test("creates Python runner", () => {
    const runner = createSnippetRunner("python");
    expect(runner.name).toBe("python");
  });

  test("creates Perl runner", () => {
    const runner = createSnippetRunner("perl");
    expect(runner.name).toBe("perl");
  });

  test("accepts aliases", () => {
    expect(createSnippetRunner("py").name).toBe("python");
    expect(createSnippetRunner("pl").name).toBe("perl");
    expect(createSnippetRunner("typescript").name).toBe("javascript");
  });

  test("throws on unknown language", () => {
    expect(() => createSnippetRunner("fortran")).toThrow("Unknown snippet language");
  });
});

describe("JsSnippetRunner", () => {
  describe("eval mode", () => {
    test("modifies record and returns it", async () => {
      const runner = new JsSnippetRunner();
      await runner.init("r.set('b', r.get('a') + 1)", { mode: "eval" });

      const result = await runner.executeRecord(new Record({ a: 5 }));
      expect(result.record).toEqual({ a: 5, b: 6 });
    });

    test("handles multiple records via executeBatch", () => {
      const runner = new JsSnippetRunner();
      void runner.init("r.set('doubled', r.get('x') * 2)", { mode: "eval" });

      const results = runner.executeBatch([
        new Record({ x: 1 }),
        new Record({ x: 5 }),
        new Record({ x: 10 }),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0]!.record!["doubled"]).toBe(2);
      expect(results[1]!.record!["doubled"]).toBe(10);
      expect(results[2]!.record!["doubled"]).toBe(20);
    });
  });

  describe("grep mode", () => {
    test("returns passed for matching records", async () => {
      const runner = new JsSnippetRunner();
      await runner.init("r.get('age') > 25", { mode: "grep" });

      const r1 = await runner.executeRecord(new Record({ age: 30 }));
      expect(r1.passed).toBe(true);

      const r2 = await runner.executeRecord(new Record({ age: 20 }));
      expect(r2.passed).toBe(false);
    });

    test("batch filtering", () => {
      const runner = new JsSnippetRunner();
      void runner.init("r.get('x') > 5", { mode: "grep" });

      const results = runner.executeBatch([
        new Record({ x: 10 }),
        new Record({ x: 3 }),
        new Record({ x: 8 }),
      ]);

      expect(results[0]!.passed).toBe(true);
      expect(results[1]!.passed).toBe(false);
      expect(results[2]!.passed).toBe(true);
    });
  });

  describe("xform mode", () => {
    test("returns modified record", async () => {
      const runner = new JsSnippetRunner();
      await runner.init("r.set('upper', String(r.get('name')).toUpperCase())", { mode: "xform" });

      const result = await runner.executeRecord(new Record({ name: "alice" }));
      expect(result.records).toHaveLength(1);
      expect(result.records![0]!["upper"]).toBe("ALICE");
    });
  });

  describe("generate mode", () => {
    test("returns generated records", async () => {
      const runner = new JsSnippetRunner();
      await runner.init("[{i: 1}, {i: 2}, {i: 3}]", { mode: "generate" });

      const result = await runner.executeRecord(new Record({ src: "test" }));
      expect(result.records).toHaveLength(3);
      expect(result.records![0]!["i"]).toBe(1);
    });
  });

  describe("error handling", () => {
    test("returns error for invalid code", () => {
      const runner = new JsSnippetRunner();
      void runner.init("throw new Error('test error')", { mode: "eval" });

      const results = runner.executeBatch([new Record({ a: 1 })]);
      expect(results[0]!.error).toContain("test error");
    });
  });

  describe("lifecycle", () => {
    test("finish and shutdown are no-ops", async () => {
      const runner = new JsSnippetRunner();
      await runner.init("true", { mode: "grep" });
      await runner.finish();
      await runner.shutdown();
      // Should not throw
    });
  });
});
