import { describe, test, expect } from "bun:test";
import { ToDb } from "../../../src/operations/output/todb.ts";
import { Record } from "../../../src/Record.ts";
import { LineCollector } from "./testHelper.ts";

describe("ToDb", () => {
  test("inserts records into SQLite database", () => {
    const collector = new LineCollector();
    const op = new ToDb(collector);
    op.init(["--dbfile", ":memory:", "--table", "test_records"]);

    op.acceptRecord(new Record({ name: "Alice", age: 30 }));
    op.acceptRecord(new Record({ name: "Bob", age: 25 }));
    op.finish();

    // No errors means success - the DB was in-memory
  });

  test("--debug prints SQL statements", () => {
    const collector = new LineCollector();
    const op = new ToDb(collector);
    op.init(["--dbfile", ":memory:", "--table", "test_recs", "--debug"]);

    op.acceptRecord(new Record({ name: "Alice", age: 30 }));
    op.finish();

    const output = collector.output();
    expect(output).toContain("Running:");
    expect(output).toContain("CREATE TABLE");
    expect(output).toContain("INSERT INTO");
  });

  test("--key limits fields", () => {
    const collector = new LineCollector();
    const op = new ToDb(collector);
    op.init(["--dbfile", ":memory:", "--debug", "--key", "name"]);

    op.acceptRecord(new Record({ name: "Alice", age: 30, extra: "data" }));
    op.finish();

    const output = collector.output();
    // Should only have 'name' column, not 'age' or 'extra'
    expect(output).toContain('"name"');
    // INSERT should only reference 'name'
    const insertLine = output.split("\n").find((l) => l.includes("INSERT"));
    expect(insertLine).toBeDefined();
    expect(insertLine).not.toContain('"age"');
  });

  test("--drop drops existing table", () => {
    const collector = new LineCollector();
    const op = new ToDb(collector);
    op.init(["--dbfile", ":memory:", "--debug", "--drop", "--table", "my_table"]);

    op.acceptRecord(new Record({ x: 1 }));
    op.finish();

    const output = collector.output();
    expect(output).toContain("DROP TABLE");
  });

  test("handles null values", () => {
    const collector = new LineCollector();
    const op = new ToDb(collector);
    op.init(["--dbfile", ":memory:", "--debug"]);

    op.acceptRecord(new Record({ name: null, value: "test" }));
    op.finish();

    const output = collector.output();
    expect(output).toContain("INSERT INTO");
  });

  test("handles special characters in values", () => {
    const collector = new LineCollector();
    const op = new ToDb(collector);
    op.init(["--dbfile", ":memory:", "--debug"]);

    op.acceptRecord(new Record({ name: "O'Brien", note: "it's a test" }));
    op.finish();

    const output = collector.output();
    // Single quotes should be properly escaped
    expect(output).toContain("O''Brien");
  });
});
