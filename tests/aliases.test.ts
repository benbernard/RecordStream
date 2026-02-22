import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadAliases,
  saveAliases,
  getAlias,
  setAlias,
  removeAlias,
  resolveAlias,
  getAliasesPath,
} from "../src/aliases.ts";

// ── getAliasesPath ──────────────────────────────────────────────

describe("getAliasesPath", () => {
  test("returns aliases.json inside given config dir", () => {
    expect(getAliasesPath("/tmp/foo")).toBe("/tmp/foo/aliases.json");
  });
});

// ── loadAliases ─────────────────────────────────────────────────

describe("loadAliases", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-alias-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns empty map when file does not exist", () => {
    expect(loadAliases(tmpDir)).toEqual({});
  });

  test("loads valid aliases from file", () => {
    const aliases = { pp: ["toprettyprint"], csv: ["fromcsv", "--header"] };
    writeFileSync(join(tmpDir, "aliases.json"), JSON.stringify(aliases), "utf-8");
    expect(loadAliases(tmpDir)).toEqual(aliases);
  });

  test("returns empty map for invalid JSON", () => {
    writeFileSync(join(tmpDir, "aliases.json"), "not json{{{", "utf-8");
    expect(loadAliases(tmpDir)).toEqual({});
  });

  test("returns empty map for JSON array", () => {
    writeFileSync(join(tmpDir, "aliases.json"), "[1,2,3]", "utf-8");
    expect(loadAliases(tmpDir)).toEqual({});
  });

  test("returns empty map for JSON null", () => {
    writeFileSync(join(tmpDir, "aliases.json"), "null", "utf-8");
    expect(loadAliases(tmpDir)).toEqual({});
  });

  test("skips entries with empty arrays", () => {
    const data = { good: ["toprettyprint"], bad: [] };
    writeFileSync(join(tmpDir, "aliases.json"), JSON.stringify(data), "utf-8");
    expect(loadAliases(tmpDir)).toEqual({ good: ["toprettyprint"] });
  });

  test("skips entries with non-string arrays", () => {
    const data = { good: ["toprettyprint"], bad: [123] };
    writeFileSync(join(tmpDir, "aliases.json"), JSON.stringify(data), "utf-8");
    expect(loadAliases(tmpDir)).toEqual({ good: ["toprettyprint"] });
  });

  test("skips entries with non-array values", () => {
    const data = { good: ["toprettyprint"], bad: "not an array" };
    writeFileSync(join(tmpDir, "aliases.json"), JSON.stringify(data), "utf-8");
    expect(loadAliases(tmpDir)).toEqual({ good: ["toprettyprint"] });
  });
});

// ── saveAliases ─────────────────────────────────────────────────

describe("saveAliases", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-alias-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("writes aliases.json to disk", () => {
    const aliases = { pp: ["toprettyprint"] };
    saveAliases(aliases, tmpDir);
    const content = readFileSync(join(tmpDir, "aliases.json"), "utf-8");
    expect(JSON.parse(content)).toEqual(aliases);
  });

  test("overwrites existing file", () => {
    saveAliases({ a: ["b"] }, tmpDir);
    saveAliases({ c: ["d"] }, tmpDir);
    const content = readFileSync(join(tmpDir, "aliases.json"), "utf-8");
    expect(JSON.parse(content)).toEqual({ c: ["d"] });
  });

  test("writes formatted JSON with trailing newline", () => {
    saveAliases({ pp: ["toprettyprint"] }, tmpDir);
    const content = readFileSync(join(tmpDir, "aliases.json"), "utf-8");
    expect(content).toEndWith("\n");
    expect(content).toContain("  "); // indented
  });
});

// ── getAlias ────────────────────────────────────────────────────

describe("getAlias", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-alias-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns undefined when alias does not exist", () => {
    expect(getAlias("pp", tmpDir)).toBeUndefined();
  });

  test("returns expansion for existing alias", () => {
    saveAliases({ pp: ["toprettyprint"] }, tmpDir);
    expect(getAlias("pp", tmpDir)).toEqual(["toprettyprint"]);
  });
});

// ── setAlias ────────────────────────────────────────────────────

describe("setAlias", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-alias-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("creates a new alias", () => {
    setAlias("pp", ["toprettyprint"], tmpDir);
    expect(loadAliases(tmpDir)).toEqual({ pp: ["toprettyprint"] });
  });

  test("overwrites an existing alias", () => {
    setAlias("pp", ["toprettyprint"], tmpDir);
    setAlias("pp", ["totable"], tmpDir);
    expect(loadAliases(tmpDir)).toEqual({ pp: ["totable"] });
  });

  test("preserves other aliases when adding", () => {
    setAlias("pp", ["toprettyprint"], tmpDir);
    setAlias("csv", ["fromcsv", "--header"], tmpDir);
    expect(loadAliases(tmpDir)).toEqual({
      pp: ["toprettyprint"],
      csv: ["fromcsv", "--header"],
    });
  });
});

// ── removeAlias ─────────────────────────────────────────────────

describe("removeAlias", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-alias-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns false when alias does not exist", () => {
    expect(removeAlias("pp", tmpDir)).toBe(false);
  });

  test("removes an existing alias and returns true", () => {
    setAlias("pp", ["toprettyprint"], tmpDir);
    expect(removeAlias("pp", tmpDir)).toBe(true);
    expect(loadAliases(tmpDir)).toEqual({});
  });

  test("preserves other aliases", () => {
    setAlias("pp", ["toprettyprint"], tmpDir);
    setAlias("csv", ["fromcsv", "--header"], tmpDir);
    removeAlias("pp", tmpDir);
    expect(loadAliases(tmpDir)).toEqual({ csv: ["fromcsv", "--header"] });
  });
});

// ── resolveAlias ────────────────────────────────────────────────

describe("resolveAlias", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-alias-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns null for non-aliased commands", () => {
    expect(resolveAlias("grep", ["{{age}} > 28"], tmpDir)).toBeNull();
  });

  test("resolves simple alias (command only)", () => {
    setAlias("pp", ["toprettyprint"], tmpDir);
    const result = resolveAlias("pp", [], tmpDir);
    expect(result).toEqual({ command: "toprettyprint", args: [] });
  });

  test("resolves alias with prepended args", () => {
    setAlias("csv", ["fromcsv", "--header"], tmpDir);
    const result = resolveAlias("csv", ["file.csv"], tmpDir);
    expect(result).toEqual({ command: "fromcsv", args: ["--header", "file.csv"] });
  });

  test("resolves chained aliases (alias pointing to alias)", () => {
    setAlias("p", ["pp"], tmpDir);
    setAlias("pp", ["toprettyprint"], tmpDir);
    const result = resolveAlias("p", [], tmpDir);
    expect(result).toEqual({ command: "toprettyprint", args: [] });
  });

  test("detects alias loops and returns null", () => {
    setAlias("a", ["b"], tmpDir);
    setAlias("b", ["a"], tmpDir);

    // Capture stderr
    const chunks: string[] = [];
    const origWrite = process.stderr.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const result = resolveAlias("a", [], tmpDir);
      expect(result).toBeNull();
      expect(chunks.join("")).toContain("Alias loop detected");
    } finally {
      process.stderr.write = origWrite;
    }
  });

  test("merges args from multi-level aliases", () => {
    setAlias("mygrep", ["grep", "-v"], tmpDir);
    const result = resolveAlias("mygrep", ["{{age}} > 28"], tmpDir);
    expect(result).toEqual({ command: "grep", args: ["-v", "{{age}} > 28"] });
  });

  test("preserves rest args after alias expansion", () => {
    setAlias("pp", ["toprettyprint"], tmpDir);
    const result = resolveAlias("pp", ["--no-header", "file.json"], tmpDir);
    expect(result).toEqual({
      command: "toprettyprint",
      args: ["--no-header", "file.json"],
    });
  });
});

// ── CLI integration (e2e) ───────────────────────────────────────

const RECS_BIN = join(import.meta.dir, "..", "bin", "recs.ts");

interface RecsResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function recs(
  args: string[],
  stdin?: string,
  env?: Record<string, string>,
): Promise<RecsResult> {
  const proc = Bun.spawn(["bun", RECS_BIN, ...args], {
    stdin: stdin ? new Buffer(stdin) : undefined,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

function parseRecords(stdout: string): Record<string, unknown>[] {
  return stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("CLI: recs alias", () => {
  let tmpDir: string;
  let env: Record<string, string>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-alias-cli-"));
    mkdirSync(join(tmpDir, "recs"), { recursive: true });
    env = { XDG_CONFIG_HOME: tmpDir };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("recs alias with no aliases shows helpful message", async () => {
    const result = await recs(["alias"], undefined, env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("No aliases defined");
  });

  test("recs alias <name> <cmd> sets an alias", async () => {
    const result = await recs(["alias", "pp", "toprettyprint"], undefined, env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("pp = toprettyprint");

    // Verify it was persisted
    const aliases = JSON.parse(
      readFileSync(join(tmpDir, "recs", "aliases.json"), "utf-8"),
    );
    expect(aliases.pp).toEqual(["toprettyprint"]);
  });

  test("recs alias <name> <cmd> <args...> sets alias with args", async () => {
    const result = await recs(
      ["alias", "csv", "fromcsv", "--header"],
      undefined,
      env,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("csv = fromcsv --header");
  });

  test("recs alias lists all aliases", async () => {
    await recs(["alias", "pp", "toprettyprint"], undefined, env);
    await recs(["alias", "csv", "fromcsv", "--header"], undefined, env);

    const result = await recs(["alias"], undefined, env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("csv = fromcsv --header");
    expect(result.stdout).toContain("pp = toprettyprint");
  });

  test("recs alias <name> shows a single alias", async () => {
    await recs(["alias", "pp", "toprettyprint"], undefined, env);

    const result = await recs(["alias", "pp"], undefined, env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("pp = toprettyprint");
  });

  test("recs alias <name> for nonexistent alias exits with error", async () => {
    const result = await recs(["alias", "nonexistent"], undefined, env);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Alias not found");
  });

  test("recs alias --remove <name> removes alias", async () => {
    await recs(["alias", "pp", "toprettyprint"], undefined, env);
    const result = await recs(["alias", "--remove", "pp"], undefined, env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Removed alias: pp");

    // Verify it's gone
    const list = await recs(["alias"], undefined, env);
    expect(list.stdout).toContain("No aliases defined");
  });

  test("recs alias -r <name> removes alias (short form)", async () => {
    await recs(["alias", "pp", "toprettyprint"], undefined, env);
    const result = await recs(["alias", "-r", "pp"], undefined, env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Removed alias: pp");
  });

  test("recs alias --remove nonexistent exits with error", async () => {
    const result = await recs(
      ["alias", "--remove", "nonexistent"],
      undefined,
      env,
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Alias not found");
  });

  test("recs alias --remove with no name shows usage", async () => {
    const result = await recs(["alias", "--remove"], undefined, env);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Usage");
  });
});

describe("CLI: alias resolution", () => {
  let tmpDir: string;
  let env: Record<string, string>;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-alias-resolve-"));
    mkdirSync(join(tmpDir, "recs"), { recursive: true });
    env = { XDG_CONFIG_HOME: tmpDir };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("alias resolves to the real command", async () => {
    await recs(["alias", "pp", "toprettyprint"], undefined, env);

    const records = [
      JSON.stringify({ name: "alice", age: 30 }),
      JSON.stringify({ name: "bob", age: 25 }),
    ].join("\n");

    const result = await recs(["pp"], records, env);
    expect(result.exitCode).toBe(0);
    // toprettyprint outputs formatted text, not JSON
    expect(result.stdout).toContain("alice");
    expect(result.stdout).toContain("bob");
  });

  test("alias with prepended args works", async () => {
    await recs(["alias", "csv", "fromcsv", "--header"], undefined, env);

    const csv = "name,age\nalice,30\nbob,25";
    const result = await recs(["csv"], csv, env);
    expect(result.exitCode).toBe(0);
    const records = parseRecords(result.stdout);
    expect(records).toHaveLength(2);
    expect(records[0]!["name"]).toBe("alice");
  });

  test("alias works with additional CLI args", async () => {
    await recs(["alias", "pp", "toprettyprint"], undefined, env);

    const records = [
      JSON.stringify({ name: "alice" }),
      JSON.stringify({ name: "bob" }),
    ].join("\n");
    const result = await recs(["pp", "--1"], records, env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("alice");
    // --1 means only print first record
    expect(result.stdout).not.toContain("bob");
  });

  test("alias works with implicit chaining (pipe)", async () => {
    await recs(["alias", "pp", "toprettyprint"], undefined, env);

    const records = [
      JSON.stringify({ name: "alice", age: 30 }),
      JSON.stringify({ name: "bob", age: 25 }),
    ].join("\n");

    // recs grep '...' | pp  (implicit chain with alias in second position)
    const result = await recs(
      ["grep", "{{age}} > 28", "|", "pp"],
      records,
      env,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("alice");
    expect(result.stdout).not.toContain("bob");
  });

  test("alias works as first command in implicit chain", async () => {
    await recs(["alias", "csv", "fromcsv", "--header"], undefined, env);

    const csv = "name,age\nalice,30\nbob,25";
    const result = await recs(["csv", "|", "totable"], csv, env);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("alice");
    expect(result.stdout).toContain("bob");
    expect(result.stdout).toContain("name");
  });

  test("alias works inside explicit chain", async () => {
    await recs(["alias", "pp", "toprettyprint"], undefined, env);

    const records = [
      JSON.stringify({ name: "alice", age: 30 }),
      JSON.stringify({ name: "bob", age: 25 }),
    ].join("\n");

    const result = await recs(
      ["chain", "grep", "{{age}} > 28", "|", "pp"],
      records,
      env,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("alice");
    expect(result.stdout).not.toContain("bob");
  });

  test("non-aliased commands still work normally", async () => {
    const records = [
      JSON.stringify({ name: "alice", age: 30 }),
    ].join("\n");

    const result = await recs(["grep", "{{age}} > 28"], records, env);
    expect(result.exitCode).toBe(0);
    const output = parseRecords(result.stdout);
    expect(output).toHaveLength(1);
    expect(output[0]!["name"]).toBe("alice");
  });
});
