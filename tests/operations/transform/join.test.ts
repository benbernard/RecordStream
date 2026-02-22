import { describe, test, expect } from "bun:test";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { JoinOperation } from "../../../src/operations/transform/join.ts";

function writeTempJsonl(records: Record[]): string {
  const filePath = join(tmpdir(), `recs-join-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
  const content = records.map((r) => r.toString()).join("\n") + "\n";
  writeFileSync(filePath, content);
  return filePath;
}

function makeOp(
  args: string[],
  dbRecords: Record[]
): { op: JoinOperation; collector: CollectorReceiver; dbFile: string } {
  const dbFile = writeTempJsonl(dbRecords);
  const collector = new CollectorReceiver();
  const op = new JoinOperation(collector);
  // Replace "dbfile" placeholder with actual temp file
  const resolvedArgs = args.map((a) => (a === "dbfile" ? dbFile : a));
  op.init(resolvedArgs);
  return { op, collector, dbFile };
}

function feedRecords(op: JoinOperation, records: Record[]): void {
  for (const r of records) {
    op.acceptRecord(r);
  }
  op.finish();
}

describe("JoinOperation", () => {
  const dbRecords = [
    new Record({ typeName: "foo", hasSetting: 1 }),
    new Record({ typeName: "bar", hasSetting: 0 }),
  ];

  test("inner join (default)", () => {
    const { op, collector, dbFile } = makeOp(
      ["type", "typeName", "dbfile"],
      dbRecords
    );
    feedRecords(op, [
      new Record({ name: "something", type: "foo" }),
      new Record({ name: "blarg", type: "hip" }),
    ]);
    unlinkSync(dbFile);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("name")).toBe("something");
    expect(collector.records[0]!.get("hasSetting")).toBe(1);
  });

  test("right join", () => {
    const { op, collector, dbFile } = makeOp(
      ["--right", "type", "typeName", "dbfile"],
      dbRecords
    );
    feedRecords(op, [
      new Record({ name: "something", type: "foo" }),
      new Record({ name: "blarg", type: "hip" }),
    ]);
    unlinkSync(dbFile);

    expect(collector.records.length).toBe(2);
    // Matched record
    expect(collector.records[0]!.get("name")).toBe("something");
    // Unmatched input record (right join keeps it)
    expect(collector.records[1]!.get("name")).toBe("blarg");
  });

  test("left join", () => {
    const { op, collector, dbFile } = makeOp(
      ["--left", "type", "typeName", "dbfile"],
      dbRecords
    );
    feedRecords(op, [
      new Record({ name: "something", type: "foo" }),
      new Record({ name: "blarg", type: "hip" }),
    ]);
    unlinkSync(dbFile);

    expect(collector.records.length).toBe(2);
    // Matched record
    expect(collector.records[0]!.get("name")).toBe("something");
    // Unmatched db record (left join keeps it)
    expect(collector.records[1]!.get("typeName")).toBe("bar");
  });

  test("outer join", () => {
    const { op, collector, dbFile } = makeOp(
      ["--outer", "type", "typeName", "dbfile"],
      dbRecords
    );
    feedRecords(op, [
      new Record({ name: "something", type: "foo" }),
      new Record({ name: "blarg", type: "hip" }),
    ]);
    unlinkSync(dbFile);

    expect(collector.records.length).toBe(3);
  });

  test("db fields overwrite input fields on match", () => {
    const { op, collector, dbFile } = makeOp(
      ["key", "key", "dbfile"],
      [new Record({ key: "a", value: "from_db" })],
    );
    feedRecords(op, [
      new Record({ key: "a", value: "from_input" }),
    ]);
    unlinkSync(dbFile);

    expect(collector.records[0]!.get("value")).toBe("from_db");
  });

  test("requires positional arguments", () => {
    expect(() => {
      const collector = new CollectorReceiver();
      const op = new JoinOperation(collector);
      op.init([]);
    }).toThrow("Usage: join");
  });

  test("accumulate-right outputs each matched db record once", () => {
    // Bug test: accumulate-right was outputting ALL db records in streamDone,
    // causing duplicates for records that already matched during acceptRecord.
    const { op, collector, dbFile } = makeOp(
      ["--accumulate-right", "type", "typeName", "dbfile"],
      [
        new Record({ typeName: "foo", total: 0 }),
        new Record({ typeName: "bar", total: 0 }),
      ],
    );
    feedRecords(op, [
      new Record({ type: "foo", val: 10 }),
      new Record({ type: "foo", val: 20 }),
    ]);
    unlinkSync(dbFile);

    // Only matched db records should be output (foo matched, bar did not)
    // In inner join (default), unmatched db records are NOT output
    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("typeName")).toBe("foo");
    expect(collector.records[0]!.get("total")).toBe(0);
  });

  test("accumulate-right with --left outputs unmatched db records too", () => {
    const { op, collector, dbFile } = makeOp(
      ["--left", "--accumulate-right", "type", "typeName", "dbfile"],
      [
        new Record({ typeName: "foo", total: 0 }),
        new Record({ typeName: "bar", total: 0 }),
      ],
    );
    feedRecords(op, [
      new Record({ type: "foo", val: 10 }),
    ]);
    unlinkSync(dbFile);

    // foo matched, bar did not — but left join includes unmatched db records
    expect(collector.records.length).toBe(2);
    const names = collector.records.map((r) => r.get("typeName"));
    expect(names).toContain("foo");
    expect(names).toContain("bar");
  });

  test("accumulate-right with --operation merges correctly", () => {
    const { op, collector, dbFile } = makeOp(
      [
        "--accumulate-right",
        "--operation", "d.total = (d.total || 0) + i.val",
        "type", "typeName", "dbfile",
      ],
      [new Record({ typeName: "foo", total: 0 })],
    );
    feedRecords(op, [
      new Record({ type: "foo", val: 10 }),
      new Record({ type: "foo", val: 20 }),
    ]);
    unlinkSync(dbFile);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("total")).toBe(30);
  });

  test("loadDbRecords still works directly", () => {
    // Test the programmatic API
    const dbFile = writeTempJsonl([]);
    const collector = new CollectorReceiver();
    const op = new JoinOperation(collector);
    op.init(["type", "typeName", dbFile]);
    // Load additional records after init
    op.loadDbRecords([new Record({ typeName: "extra", extraField: true })]);
    feedRecords(op, [
      new Record({ name: "test", type: "extra" }),
    ]);
    unlinkSync(dbFile);

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("extraField")).toBe(true);
  });
});
