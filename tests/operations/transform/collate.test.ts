import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { CollateOperation } from "../../../src/operations/transform/collate.ts";

// Import the real aggregator registry so all aggregators are available
import "../../../src/aggregators/registry.ts";

function makeOp(args: string[]): { op: CollateOperation; collector: CollectorReceiver } {
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

describe("Cube mode", () => {
  test("single key produces value and ALL groups", () => {
    const { op, collector } = makeOp(["--key", "color", "--cube", "-a", "count"]);
    feedRecords(op, [
      new Record({ color: "red", x: 1 }),
      new Record({ color: "blue", x: 2 }),
      new Record({ color: "red", x: 3 }),
    ]);

    // 2 unique values + ALL = 3 groups
    expect(collector.records.length).toBe(3);

    const byColor = new Map<string, number>();
    for (const r of collector.records) {
      byColor.set(r.get("color") as string, r.get("count") as number);
    }
    expect(byColor.get("red")).toBe(2);
    expect(byColor.get("blue")).toBe(1);
    expect(byColor.get("ALL")).toBe(3);
  });

  test("two keys produce all 2^2 combinations", () => {
    const { op, collector } = makeOp(["--key", "a,b", "--cube", "-a", "count"]);
    feedRecords(op, [
      new Record({ a: "x", b: "y" }),
      new Record({ a: "x", b: "z" }),
    ]);

    // Groups: (x,y), (ALL,y), (x,ALL), (ALL,ALL), (x,z), (ALL,z)
    expect(collector.records.length).toBe(6);

    const byKey = new Map<string, number>();
    for (const r of collector.records) {
      const key = `${r.get("a")},${r.get("b")}`;
      byKey.set(key, r.get("count") as number);
    }
    expect(byKey.get("x,y")).toBe(1);
    expect(byKey.get("x,z")).toBe(1);
    expect(byKey.get("ALL,y")).toBe(1);
    expect(byKey.get("ALL,z")).toBe(1);
    expect(byKey.get("x,ALL")).toBe(2);
    expect(byKey.get("ALL,ALL")).toBe(2);
  });

  test("cube with sum aggregation", () => {
    const { op, collector } = makeOp([
      "--key", "region,product", "--cube",
      "-a", "revenue=sum,amount",
    ]);
    feedRecords(op, [
      new Record({ region: "east", product: "A", amount: 100 }),
      new Record({ region: "east", product: "B", amount: 200 }),
      new Record({ region: "west", product: "A", amount: 300 }),
    ]);

    const byKey = new Map<string, number>();
    for (const r of collector.records) {
      const key = `${r.get("region")},${r.get("product")}`;
      byKey.set(key, r.get("revenue") as number);
    }

    // Specific combos
    expect(byKey.get("east,A")).toBe(100);
    expect(byKey.get("east,B")).toBe(200);
    expect(byKey.get("west,A")).toBe(300);

    // Rollups
    expect(byKey.get("east,ALL")).toBe(300);
    expect(byKey.get("west,ALL")).toBe(300);
    expect(byKey.get("ALL,A")).toBe(400);
    expect(byKey.get("ALL,B")).toBe(200);
    expect(byKey.get("ALL,ALL")).toBe(600);
  });
});

describe("Domain language", () => {
  test("--dlaggregator with sum", () => {
    const { op, collector } = makeOp(["--dlaggregator", 'my_sum=sum("x")']);
    feedRecords(op, [
      new Record({ x: 10 }),
      new Record({ x: 20 }),
      new Record({ x: 30 }),
    ]);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("my_sum")).toBe(60);
  });

  test("--dlaggregator with count", () => {
    const { op, collector } = makeOp(["--dlaggregator", "n=count()"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ]);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("n")).toBe(2);
  });

  test("--dlaggregator combined with regular aggregator", () => {
    const { op, collector } = makeOp([
      "-a", "count",
      "--dlaggregator", 'total=sum("x")',
    ]);
    feedRecords(op, [
      new Record({ x: 5 }),
      new Record({ x: 15 }),
    ]);

    expect(collector.records[0]!.get("count")).toBe(2);
    expect(collector.records[0]!.get("total")).toBe(20);
  });

  test("--dlaggregator with key grouping", () => {
    const { op, collector } = makeOp([
      "--key", "group",
      "--dlaggregator", 'total=sum("val")',
    ]);
    feedRecords(op, [
      new Record({ group: "A", val: 10 }),
      new Record({ group: "B", val: 20 }),
      new Record({ group: "A", val: 30 }),
    ]);

    const byGroup = new Map<string, number>();
    for (const r of collector.records) {
      byGroup.set(r.get("group") as string, r.get("total") as number);
    }
    expect(byGroup.get("A")).toBe(40);
    expect(byGroup.get("B")).toBe(20);
  });

  test("--dlaggregator errors on missing = separator", () => {
    expect(() => {
      makeOp(["--dlaggregator", "bad_spec_no_equals"]);
    }).toThrow(/missing '='/);
  });
});

describe("Null and missing value handling", () => {
  test("null key values are grouped together", () => {
    const { op, collector } = makeOp(["--key", "group", "-a", "count"]);
    feedRecords(op, [
      new Record({ group: "A", x: 1 }),
      new Record({ group: null, x: 2 }),
      new Record({ x: 3 }), // missing group key
    ]);

    expect(collector.records.length).toBe(2);

    const byGroup = new Map<string, number>();
    for (const r of collector.records) {
      const key = String(r.get("group"));
      byGroup.set(key, r.get("count") as number);
    }
    expect(byGroup.get("A")).toBe(1);
    // null and undefined/missing are grouped together
    expect(byGroup.get("null")).toBe(2);
  });

  test("sum skips null/undefined values in field", () => {
    const { op, collector } = makeOp(["-a", "total=sum,x"]);
    feedRecords(op, [
      new Record({ x: 10 }),
      new Record({ x: null }),
      new Record({ y: 5 }), // x is missing
      new Record({ x: 20 }),
    ]);

    expect(collector.records.length).toBe(1);
    // sum of 10 + NaN(null) + NaN(undefined) + 20 — depends on implementation
    // The hand-registered sum in old test doesn't skip nulls, but real Sum does
    const total = collector.records[0]!.get("total") as number;
    expect(total).toBe(30);
  });

  test("count counts all records including those with null keys", () => {
    const { op, collector } = makeOp([
      "--key", "category",
      "-a", "count",
    ]);
    feedRecords(op, [
      new Record({ category: "A" }),
      new Record({ category: "A" }),
      new Record({ category: null }),
      new Record({}), // missing category
    ]);

    const byCategory = new Map<string, number>();
    for (const r of collector.records) {
      const key = String(r.get("category"));
      byCategory.set(key, r.get("count") as number);
    }
    expect(byCategory.get("A")).toBe(2);
    expect(byCategory.get("null")).toBe(2);
  });

  test("avg handles null values gracefully", () => {
    const { op, collector } = makeOp(["-a", "avg,x"]);
    feedRecords(op, [
      new Record({ x: 10 }),
      new Record({ x: null }),
      new Record({ x: 30 }),
    ]);

    expect(collector.records.length).toBe(1);
    // avg should skip nulls: (10 + 30) / 2 = 20
    expect(collector.records[0]!.get("avg_x")).toBe(20);
  });
});

describe("--no-bucket mode", () => {
  test("outputs one record per input record with aggregated values", () => {
    const { op, collector } = makeOp([
      "--key", "area",
      "--no-bucket",
      "-a", "count",
    ]);
    feedRecords(op, [
      new Record({ area: "A", x: 1 }),
      new Record({ area: "B", x: 2 }),
      new Record({ area: "A", x: 3 }),
    ]);

    // One output per input record
    expect(collector.records.length).toBe(3);

    // Each record retains its original fields plus the aggregated values
    const aRecords = collector.records.filter(r => r.get("area") === "A");
    const bRecords = collector.records.filter(r => r.get("area") === "B");
    expect(aRecords.length).toBe(2);
    expect(bRecords.length).toBe(1);

    // All records in same group get the same aggregated value
    for (const r of aRecords) {
      expect(r.get("count")).toBe(2);
    }
    expect(bRecords[0]!.get("count")).toBe(1);
  });

  test("preserves original record fields", () => {
    const { op, collector } = makeOp([
      "--key", "area",
      "--no-bucket",
      "-a", "total=sum,x",
    ]);
    feedRecords(op, [
      new Record({ area: "A", x: 10, extra: "hello" }),
      new Record({ area: "A", x: 20, extra: "world" }),
    ]);

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("extra")).toBe("hello");
    expect(collector.records[1]!.get("extra")).toBe("world");
    expect(collector.records[0]!.get("total")).toBe(30);
    expect(collector.records[1]!.get("total")).toBe(30);
  });

  test("no-bucket without key: all records get same aggregation", () => {
    const { op, collector } = makeOp([
      "--no-bucket",
      "-a", "count",
    ]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ]);

    expect(collector.records.length).toBe(3);
    for (const r of collector.records) {
      expect(r.get("count")).toBe(3);
    }
  });
});

describe("--mr-agg (MapReduce aggregator)", () => {
  test("basic map-reduce count", () => {
    const { op, collector } = makeOp(["--mr-agg", "my_count", "1", "$a + $b", "$a"]);
    feedRecords(op, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ]);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("my_count")).toBe(3);
  });

  test("map-reduce sum with field access", () => {
    const { op, collector } = makeOp([
      "--mr-agg", "total", "{{x}}", "$a + $b", "$a",
    ]);
    feedRecords(op, [
      new Record({ x: 10 }),
      new Record({ x: 20 }),
      new Record({ x: 30 }),
    ]);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("total")).toBe(60);
  });

  test("map-reduce with key grouping", () => {
    const { op, collector } = makeOp([
      "--key", "group",
      "--mr-agg", "total", "{{val}}", "$a + $b", "$a",
    ]);
    feedRecords(op, [
      new Record({ group: "A", val: 10 }),
      new Record({ group: "B", val: 20 }),
      new Record({ group: "A", val: 30 }),
    ]);

    const byGroup = new Map<string, number>();
    for (const r of collector.records) {
      byGroup.set(r.get("group") as string, r.get("total") as number);
    }
    expect(byGroup.get("A")).toBe(40);
    expect(byGroup.get("B")).toBe(20);
  });

  test("map-reduce combined with regular aggregator", () => {
    const { op, collector } = makeOp([
      "-a", "count",
      "--mr-agg", "total", "{{x}}", "$a + $b", "$a",
    ]);
    feedRecords(op, [
      new Record({ x: 5 }),
      new Record({ x: 15 }),
    ]);

    expect(collector.records[0]!.get("count")).toBe(2);
    expect(collector.records[0]!.get("total")).toBe(20);
  });
});

describe("--ii-agg (InjectInto aggregator)", () => {
  test("basic inject-into sum", () => {
    const { op, collector } = makeOp([
      "--ii-agg", "total", "0", "$a + {{x}}", "$a",
    ]);
    feedRecords(op, [
      new Record({ x: 10 }),
      new Record({ x: 20 }),
      new Record({ x: 30 }),
    ]);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("total")).toBe(60);
  });

  test("inject-into with array accumulator", () => {
    const { op, collector } = makeOp([
      "--ii-agg", "result", "[0,0]", "[$a[0]+{{val}},$a[1]+1]", "$a[0]/$a[1]",
    ]);
    feedRecords(op, [
      new Record({ val: 10 }),
      new Record({ val: 20 }),
      new Record({ val: 30 }),
    ]);

    expect(collector.records.length).toBe(1);
    // Average: (10+20+30)/3 = 20
    expect(collector.records[0]!.get("result")).toBe(20);
  });

  test("inject-into with key grouping", () => {
    const { op, collector } = makeOp([
      "--key", "group",
      "--ii-agg", "total", "0", "$a + {{val}}", "$a",
    ]);
    feedRecords(op, [
      new Record({ group: "A", val: 10 }),
      new Record({ group: "B", val: 20 }),
      new Record({ group: "A", val: 30 }),
    ]);

    const byGroup = new Map<string, number>();
    for (const r of collector.records) {
      byGroup.set(r.get("group") as string, r.get("total") as number);
    }
    expect(byGroup.get("A")).toBe(40);
    expect(byGroup.get("B")).toBe(20);
  });
});
