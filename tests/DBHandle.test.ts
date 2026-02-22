import { describe, test, expect, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { CollectorReceiver } from "../src/Operation.ts";
import { FromDb } from "../src/operations/input/fromdb.ts";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DB = join(tmpdir(), `recs-test-${Date.now()}.db`);

function cleanupDb(): void {
  if (existsSync(TEST_DB)) {
    unlinkSync(TEST_DB);
  }
}

afterEach(cleanupDb);

describe("Database Handle", () => {
  test("create and query a sqlite database", () => {
    // Create a test database
    const db = new Database(TEST_DB);
    db.run("CREATE TABLE foo (id INTEGER PRIMARY KEY, name TEXT)");
    db.run("INSERT INTO foo (id, name) VALUES (1, 'alice')");
    db.run("INSERT INTO foo (id, name) VALUES (2, 'bob')");
    db.close();

    // Query through fromdb
    const collector = new CollectorReceiver();
    const op = new FromDb(collector);
    op.init(["--type", "sqlite", "--dbfile", TEST_DB, "--table", "foo"]);
    op.finish();

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("id")).toBe(1);
    expect(collector.records[0]!.get("name")).toBe("alice");
    expect(collector.records[1]!.get("id")).toBe(2);
    expect(collector.records[1]!.get("name")).toBe("bob");
  });

  test("query with SQL statement", () => {
    const db = new Database(TEST_DB);
    db.run("CREATE TABLE items (id INTEGER, value REAL)");
    db.run("INSERT INTO items VALUES (1, 10.5)");
    db.run("INSERT INTO items VALUES (2, 20.0)");
    db.run("INSERT INTO items VALUES (3, 30.5)");
    db.close();

    const collector = new CollectorReceiver();
    const op = new FromDb(collector);
    op.init(["--dbfile", TEST_DB, "--sql", "SELECT * FROM items WHERE value > 15"]);
    op.finish();

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("id")).toBe(2);
    expect(collector.records[1]!.get("id")).toBe(3);
  });

  test("requires table or sql", () => {
    expect(() => {
      const op = new FromDb(new CollectorReceiver());
      op.init(["--dbfile", TEST_DB]);
    }).toThrow("Must define --table or --sql");
  });

  test("requires dbfile for sqlite", () => {
    const collector = new CollectorReceiver();
    const op = new FromDb(collector);
    op.init(["--table", "foo"]);

    expect(() => {
      op.finish();
    }).toThrow("--dbfile is required");
  });

  test("handles empty result set", () => {
    const db = new Database(TEST_DB);
    db.run("CREATE TABLE empty_table (id INTEGER)");
    db.close();

    const collector = new CollectorReceiver();
    const op = new FromDb(collector);
    op.init(["--dbfile", TEST_DB, "--table", "empty_table"]);
    op.finish();

    expect(collector.records.length).toBe(0);
  });

  test("handles multiple column types", () => {
    const db = new Database(TEST_DB);
    db.run("CREATE TABLE mixed (i INTEGER, r REAL, t TEXT, b BLOB)");
    db.run("INSERT INTO mixed VALUES (42, 3.14, 'hello', X'DEADBEEF')");
    db.close();

    const collector = new CollectorReceiver();
    const op = new FromDb(collector);
    op.init(["--dbfile", TEST_DB, "--table", "mixed"]);
    op.finish();

    expect(collector.records.length).toBe(1);
    const rec = collector.records[0]!;
    expect(rec.get("i")).toBe(42);
    expect(rec.get("r")).toBeCloseTo(3.14);
    expect(rec.get("t")).toBe("hello");
  });
});
