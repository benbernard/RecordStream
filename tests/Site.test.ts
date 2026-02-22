import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadPlugins } from "../src/Site.ts";
import { isRecsOperation, createOperation } from "../src/operations/transform/chain.ts";
import { CollectorReceiver } from "../src/Operation.ts";

describe("Site plugin system", () => {
  let pluginDir: string;
  let origEnv: string | undefined;

  beforeAll(() => {
    origEnv = process.env["RECS_PLUGIN_DIR"];

    // Create a temp plugin directory
    pluginDir = mkdtempSync(join(tmpdir(), "recs-plugins-"));

    // Write a simple plugin that exports a factory
    const srcRoot = join(process.cwd(), "src");
    writeFileSync(
      join(pluginDir, "my-noop.ts"),
      `
import { Operation } from "${join(srcRoot, "Operation.ts")}";
import type { RecordReceiver } from "${join(srcRoot, "Operation.ts")}";
import { Record } from "${join(srcRoot, "Record.ts")}";

export const documentation = {
  name: "my-noop",
  category: "transform" as const,
  synopsis: "recs my-noop",
  description: "A no-op plugin for testing.",
  options: [],
  examples: [],
};

class NoopOperation extends Operation {
  init(_args: string[]): void {}

  acceptRecord(record: Record): boolean {
    this.pushRecord(record);
    return true;
  }

  streamDone(): void {}
}

export function factory(next: RecordReceiver): Operation {
  const op = new NoopOperation(next);
  return op;
}
`
    );

    // Write a plugin with a default export
    writeFileSync(
      join(pluginDir, "my-upper.ts"),
      `
import { Operation } from "${join(srcRoot, "Operation.ts")}";
import type { RecordReceiver } from "${join(srcRoot, "Operation.ts")}";
import { Record } from "${join(srcRoot, "Record.ts")}";

export default class UpperOperation extends Operation {
  init(_args: string[]): void {}

  acceptRecord(record: Record): boolean {
    const data = record.dataRef() as { [key: string]: unknown };
    const upper: { [key: string]: unknown } = {};
    for (const [k, v] of Object.entries(data)) {
      upper[k] = typeof v === "string" ? v.toUpperCase() : v;
    }
    this.pushRecord(new Record(upper));
    return true;
  }

  streamDone(): void {}
}
`
    );

    // Write a file that exports nothing useful (should be skipped)
    writeFileSync(
      join(pluginDir, "not-a-plugin.ts"),
      `export const helper = 42;\n`
    );
  });

  afterAll(() => {
    // Restore env
    if (origEnv === undefined) {
      delete process.env["RECS_PLUGIN_DIR"];
    } else {
      process.env["RECS_PLUGIN_DIR"] = origEnv;
    }

    // Clean up temp dir
    rmSync(pluginDir, { recursive: true, force: true });
  });

  test("returns empty array when RECS_PLUGIN_DIR is unset", async () => {
    delete process.env["RECS_PLUGIN_DIR"];
    const loaded = await loadPlugins();
    expect(loaded).toEqual([]);
  });

  test("returns empty array when RECS_PLUGIN_DIR does not exist", async () => {
    process.env["RECS_PLUGIN_DIR"] = "/tmp/nonexistent-recs-plugin-dir-99999";
    const loaded = await loadPlugins();
    expect(loaded).toEqual([]);
  });

  test("loads plugins from directory and registers factories", async () => {
    process.env["RECS_PLUGIN_DIR"] = pluginDir;
    const loaded = await loadPlugins();

    // Should have loaded 2 plugins (my-noop and my-upper, not not-a-plugin)
    expect(loaded.length).toBe(2);
    const names = loaded.map((p) => p.name).sort();
    expect(names).toEqual(["my-noop", "my-upper"]);

    // my-noop should have documentation
    const noopPlugin = loaded.find((p) => p.name === "my-noop");
    expect(noopPlugin?.documentation?.name).toBe("my-noop");
    expect(noopPlugin?.documentation?.category).toBe("transform");
  });

  test("registered factory operations work via createOperation", async () => {
    process.env["RECS_PLUGIN_DIR"] = pluginDir;
    await loadPlugins();

    expect(isRecsOperation("my-noop")).toBe(true);

    const collector = new CollectorReceiver();
    const op = createOperation("my-noop", [], collector);

    const { Record } = await import("../src/Record.ts");
    op.acceptRecord(new Record({ greeting: "hello" }));
    op.finish();

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("greeting")).toBe("hello");
  });
});
