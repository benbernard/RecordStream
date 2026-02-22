import { describe, test, expect, afterAll } from "bun:test";
import { readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver, Operation } from "../../../src/Operation.ts";
import type { RecordReceiver } from "../../../src/Operation.ts";
import { MultiplexOperation } from "../../../src/operations/transform/multiplex.ts";
import { registerOperationFactory } from "../../../src/operations/transform/chain.ts";
import { ToCsv } from "../../../src/operations/output/tocsv.ts";
import { XformOperation } from "../../../src/operations/transform/xform.ts";

// Register operations so multiplex can create them
class PassthroughOp extends Operation {
  init(_args: string[]): void {
    // no-op
  }
  acceptRecord(record: Record): boolean {
    return this.pushRecord(record);
  }
}

registerOperationFactory("passthrough", (next: RecordReceiver) => new PassthroughOp(next));
registerOperationFactory("tocsv", (next: RecordReceiver) => new ToCsv(next));
registerOperationFactory("xform", (next: RecordReceiver) => new XformOperation(next));

// Temp directory for file-output tests
const tmpBase = join(tmpdir(), `recs-multiplex-test-${process.pid}-${Date.now()}`);
mkdirSync(tmpBase, { recursive: true });

afterAll(() => {
  if (existsSync(tmpBase)) {
    rmSync(tmpBase, { recursive: true, force: true });
  }
});

function makeOp(args: string[]): { op: MultiplexOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new MultiplexOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: MultiplexOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("MultiplexOperation", () => {
  test("basic passthrough multiplex", () => {
    const { op, collector } = makeOp(["passthrough"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ]);

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("x")).toBe(1);
    expect(collector.records[1]!.get("x")).toBe(2);
  });

  test("multiplex with key grouping", () => {
    const { op, collector } = makeOp(["-k", "group", "passthrough"]);
    feedRecords(op, [
      new Record({ group: "a", val: 1 }),
      new Record({ group: "a", val: 2 }),
      new Record({ group: "b", val: 3 }),
    ]);

    expect(collector.records.length).toBe(3);
  });

  test("requires operation name", () => {
    expect(() => {
      makeOp([]);
    }).toThrow("multiplex requires an operation");
  });

  test("multiplex with line-based output op (tocsv) to stdout", () => {
    const { op, collector } = makeOp(["-k", "dept", "--", "tocsv", "--noheader", "-k", "name,score"]);
    feedRecords(op, [
      new Record({ dept: "eng", name: "alice", score: 90 }),
      new Record({ dept: "eng", name: "bob", score: 85 }),
      new Record({ dept: "sales", name: "carol", score: 70 }),
    ]);

    // tocsv pushes lines, not records — the collector must receive them
    expect(collector.lines.length).toBe(3);
    expect(collector.records.length).toBe(0);

    // Verify CSV content: each group gets its own tocsv instance
    const allLines = collector.lines.join("\n");
    expect(allLines).toContain("alice,90");
    expect(allLines).toContain("bob,85");
    expect(allLines).toContain("carol,70");
  });

  test("multiplex with tocsv including header per group", () => {
    const { op, collector } = makeOp(["-k", "dept", "--", "tocsv", "-k", "name,score"]);
    feedRecords(op, [
      new Record({ dept: "eng", name: "alice", score: 90 }),
      new Record({ dept: "eng", name: "bob", score: 85 }),
      new Record({ dept: "sales", name: "carol", score: 70 }),
    ]);

    // Each group gets its own tocsv instance, so each emits a header
    // eng group: header + 2 data rows = 3 lines
    // sales group: header + 1 data row = 2 lines
    expect(collector.lines.length).toBe(5);

    // Both groups should produce a "name,score" header line
    const headerCount = collector.lines.filter(l => l === "name,score").length;
    expect(headerCount).toBe(2);
  });

  test("multiplex with --output-file-key writes line-based output to files", () => {
    const outDir = join(tmpBase, "output-file-key");
    mkdirSync(outDir, { recursive: true });

    const fileA = join(outDir, "eng.csv");
    const fileB = join(outDir, "sales.csv");

    // Group by outfile so it's available in group options for resolveOutputFile
    const { op, collector } = makeOp([
      "-k", "outfile",
      "--output-file-key", "outfile",
      "--", "tocsv", "--noheader", "-k", "name,score",
    ]);
    feedRecords(op, [
      new Record({ dept: "eng", name: "alice", score: 90, outfile: fileA }),
      new Record({ dept: "eng", name: "bob", score: 85, outfile: fileA }),
      new Record({ dept: "sales", name: "carol", score: 70, outfile: fileB }),
    ]);

    // Lines should NOT go to the collector when writing to files
    expect(collector.lines.length).toBe(0);
    expect(collector.records.length).toBe(0);

    // Files should exist with correct CSV content
    const contentA = readFileSync(fileA, "utf-8");
    expect(contentA).toContain("alice,90");
    expect(contentA).toContain("bob,85");
    expect(contentA.trim().split("\n").length).toBe(2);

    const contentB = readFileSync(fileB, "utf-8");
    expect(contentB).toContain("carol,70");
    expect(contentB.trim().split("\n").length).toBe(1);
  });

  test("multiplex with --output-file-eval and {{key}} interpolation", () => {
    const outDir = join(tmpBase, "output-file-eval");
    mkdirSync(outDir, { recursive: true });

    const { op, collector } = makeOp([
      "-k", "dept",
      "--output-file-eval", join(outDir, "report-{{dept}}.csv"),
      "--", "tocsv", "--noheader", "-k", "name,score",
    ]);
    feedRecords(op, [
      new Record({ dept: "eng", name: "alice", score: 90 }),
      new Record({ dept: "eng", name: "bob", score: 85 }),
      new Record({ dept: "sales", name: "carol", score: 70 }),
    ]);

    expect(collector.lines.length).toBe(0);
    expect(collector.records.length).toBe(0);

    // Verify files created with interpolated names
    const engFile = join(outDir, "report-eng.csv");
    const salesFile = join(outDir, "report-sales.csv");

    expect(existsSync(engFile)).toBe(true);
    expect(existsSync(salesFile)).toBe(true);

    const engContent = readFileSync(engFile, "utf-8");
    expect(engContent).toContain("alice,90");
    expect(engContent).toContain("bob,85");

    const salesContent = readFileSync(salesFile, "utf-8");
    expect(salesContent).toContain("carol,70");
  });

  test("multiplex with record-based transform op (xform)", () => {
    const { op, collector } = makeOp([
      "-k", "dept", "--",
      "xform", "{{tagged}} = {{dept}} + '-' + {{name}}",
    ]);
    feedRecords(op, [
      new Record({ dept: "eng", name: "alice" }),
      new Record({ dept: "eng", name: "bob" }),
      new Record({ dept: "sales", name: "carol" }),
    ]);

    // xform pushes records, not lines
    expect(collector.records.length).toBe(3);
    expect(collector.lines.length).toBe(0);

    const tags = collector.records.map(r => r.get("tagged") as string);
    expect(tags).toContain("eng-alice");
    expect(tags).toContain("eng-bob");
    expect(tags).toContain("sales-carol");
  });

  test("multiplex with record-based passthrough and --output-file-key", () => {
    const outDir = join(tmpBase, "record-output-file");
    mkdirSync(outDir, { recursive: true });

    const fileA = join(outDir, "groupA.jsonl");
    const fileB = join(outDir, "groupB.jsonl");

    // Group by outfile so it's available in group options
    const { op, collector } = makeOp([
      "-k", "outfile",
      "--output-file-key", "outfile",
      "--", "passthrough",
    ]);
    feedRecords(op, [
      new Record({ group: "a", val: 1, outfile: fileA }),
      new Record({ group: "a", val: 2, outfile: fileA }),
      new Record({ group: "b", val: 3, outfile: fileB }),
    ]);

    expect(collector.records.length).toBe(0);
    expect(collector.lines.length).toBe(0);

    const contentA = readFileSync(fileA, "utf-8").trim().split("\n");
    expect(contentA.length).toBe(2);
    expect(JSON.parse(contentA[0]!)).toMatchObject({ group: "a", val: 1 });
    expect(JSON.parse(contentA[1]!)).toMatchObject({ group: "a", val: 2 });

    const contentB = readFileSync(fileB, "utf-8").trim().split("\n");
    expect(contentB.length).toBe(1);
    expect(JSON.parse(contentB[0]!)).toMatchObject({ group: "b", val: 3 });
  });
});
