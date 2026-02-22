import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { SortOperation } from "../../../src/operations/transform/sort.ts";

function makeOp(args: string[]): { op: SortOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new SortOperation(collector);
  op.init(args);
  return { op, collector };
}

function feedRecords(op: SortOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("SortOperation", () => {
  test("sorts lexically by default", () => {
    const { op, collector } = makeOp(["--key", "name"]);
    feedRecords(op, [
      new Record({ name: "charlie" }),
      new Record({ name: "alpha" }),
      new Record({ name: "bravo" }),
    ]);

    expect(collector.records.map((r) => r.get("name"))).toEqual([
      "alpha", "bravo", "charlie",
    ]);
  });

  test("sorts numerically", () => {
    const { op, collector } = makeOp(["--key", "id=numeric"]);
    feedRecords(op, [
      new Record({ id: 10 }),
      new Record({ id: 2 }),
      new Record({ id: 100 }),
    ]);

    expect(collector.records.map((r) => r.get("id"))).toEqual([2, 10, 100]);
  });

  test("sorts descending with -", () => {
    const { op, collector } = makeOp(["--key", "id=-numeric"]);
    feedRecords(op, [
      new Record({ id: 10 }),
      new Record({ id: 2 }),
      new Record({ id: 100 }),
    ]);

    expect(collector.records.map((r) => r.get("id"))).toEqual([100, 10, 2]);
  });

  test("reverse flag", () => {
    const { op, collector } = makeOp(["--key", "name", "--reverse"]);
    feedRecords(op, [
      new Record({ name: "alpha" }),
      new Record({ name: "charlie" }),
      new Record({ name: "bravo" }),
    ]);

    expect(collector.records.map((r) => r.get("name"))).toEqual([
      "charlie", "bravo", "alpha",
    ]);
  });

  test("multi-key sort", () => {
    const { op, collector } = makeOp(["--key", "area", "--key", "name"]);
    feedRecords(op, [
      new Record({ area: "B", name: "zeta" }),
      new Record({ area: "A", name: "beta" }),
      new Record({ area: "A", name: "alpha" }),
      new Record({ area: "B", name: "alpha" }),
    ]);

    expect(collector.records.map((r) => `${r.get("area")}-${r.get("name")}`)).toEqual([
      "A-alpha", "A-beta", "B-alpha", "B-zeta",
    ]);
  });

  test("comma-separated keys", () => {
    const { op, collector } = makeOp(["--key", "area,name"]);
    feedRecords(op, [
      new Record({ area: "B", name: "zeta" }),
      new Record({ area: "A", name: "beta" }),
    ]);

    expect(collector.records.map((r) => `${r.get("area")}-${r.get("name")}`)).toEqual([
      "A-beta", "B-zeta",
    ]);
  });

  test("stable sort", () => {
    const { op, collector } = makeOp(["--key", "x"]);
    feedRecords(op, [
      new Record({ x: "a", order: 1 }),
      new Record({ x: "a", order: 2 }),
      new Record({ x: "a", order: 3 }),
    ]);

    expect(collector.records.map((r) => r.get("order"))).toEqual([1, 2, 3]);
  });
});
