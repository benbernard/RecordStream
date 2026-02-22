import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { CollateOperation } from "../../../src/operations/transform/collate.ts";
import { aggregatorRegistry } from "../../../src/Aggregator.ts";
import type { Aggregator } from "../../../src/Aggregator.ts";
import type { JsonValue } from "../../../src/types/json.ts";

// Register basic aggregators for testing
function registerTestAggregators(): void {
  if (aggregatorRegistry.has("count")) return;

  aggregatorRegistry.register("count", {
    create: () => ({
      initial: () => 0,
      combine: (state: unknown) => (state as number) + 1,
      squish: (state: unknown) => state as JsonValue,
    }) as Aggregator,
    argCounts: [0],
    shortUsage: "Count records",
    longUsage: "Counts the number of records",
    aliases: ["ct"],
  });

  aggregatorRegistry.register("sum", {
    create: (field: string) => ({
      initial: () => 0,
      combine: (state: unknown, record: Record) => {
        const val = record.get(field);
        return (state as number) + (typeof val === "number" ? val : Number(val));
      },
      squish: (state: unknown) => state as JsonValue,
    }) as Aggregator,
    argCounts: [1],
    shortUsage: "Sum a field",
    longUsage: "Sums the values of the specified field",
  });

  aggregatorRegistry.register("max", {
    create: (field: string) => ({
      initial: () => -Infinity,
      combine: (state: unknown, record: Record) => {
        const val = Number(record.get(field));
        return Math.max(state as number, val);
      },
      squish: (state: unknown) => state as JsonValue,
    }) as Aggregator,
    argCounts: [1],
    shortUsage: "Max of a field",
    longUsage: "Finds the maximum value of the specified field",
  });

  aggregatorRegistry.register("min", {
    create: (field: string) => ({
      initial: () => Infinity,
      combine: (state: unknown, record: Record) => {
        const val = Number(record.get(field));
        return Math.min(state as number, val);
      },
      squish: (state: unknown) => state as JsonValue,
    }) as Aggregator,
    argCounts: [1],
    shortUsage: "Min of a field",
    longUsage: "Finds the minimum value of the specified field",
  });
}

function makeOp(args: string[]): { op: CollateOperation; collector: CollectorReceiver } {
  registerTestAggregators();
  const collector = new CollectorReceiver();
  const op = new CollateOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: CollateOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("CollateOperation", () => {
  test("count aggregator without key", () => {
    const { op, collector } = makeOp(["--aggregator", "count"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ]);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("count")).toBe(3);
  });

  test("count aggregator with key grouping", () => {
    const { op, collector } = makeOp(["--key", "area", "--aggregator", "count"]);
    feedRecords(op, [
      new Record({ area: "A", x: 1 }),
      new Record({ area: "B", x: 2 }),
      new Record({ area: "A", x: 3 }),
      new Record({ area: "B", x: 4 }),
      new Record({ area: "A", x: 5 }),
    ]);

    expect(collector.records.length).toBe(2);

    const byArea = new Map<string, number>();
    for (const r of collector.records) {
      byArea.set(r.get("area") as string, r.get("count") as number);
    }
    expect(byArea.get("A")).toBe(3);
    expect(byArea.get("B")).toBe(2);
  });

  test("sum aggregator", () => {
    const { op, collector } = makeOp(["--aggregator", "total=sum,x"]);
    feedRecords(op, [
      new Record({ x: 10 }),
      new Record({ x: 20 }),
      new Record({ x: 30 }),
    ]);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("total")).toBe(60);
  });

  test("multiple aggregators", () => {
    const { op, collector } = makeOp([
      "--aggregator", "count",
      "--aggregator", "total=sum,x",
    ]);
    feedRecords(op, [
      new Record({ x: 10 }),
      new Record({ x: 20 }),
    ]);

    expect(collector.records[0]!.get("count")).toBe(2);
    expect(collector.records[0]!.get("total")).toBe(30);
  });

  test("max aggregator with key", () => {
    const { op, collector } = makeOp([
      "--key", "group",
      "--aggregator", "worst=max,latency",
    ]);
    feedRecords(op, [
      new Record({ group: "A", latency: 100 }),
      new Record({ group: "A", latency: 200 }),
      new Record({ group: "B", latency: 50 }),
      new Record({ group: "B", latency: 150 }),
    ]);

    const byGroup = new Map<string, number>();
    for (const r of collector.records) {
      byGroup.set(r.get("group") as string, r.get("worst") as number);
    }
    expect(byGroup.get("A")).toBe(200);
    expect(byGroup.get("B")).toBe(150);
  });

  test("named aggregator with = syntax", () => {
    const { op, collector } = makeOp(["--aggregator", "my_count=count"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ]);

    expect(collector.records[0]!.get("my_count")).toBe(2);
  });

  test("incremental mode", () => {
    const { op, collector } = makeOp([
      "--incremental",
      "--aggregator", "count",
    ]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ]);

    // Incremental mode outputs after each record
    expect(collector.records.length).toBe(3);
    expect(collector.records[0]!.get("count")).toBe(1);
    expect(collector.records[1]!.get("count")).toBe(2);
    expect(collector.records[2]!.get("count")).toBe(3);
  });
});
