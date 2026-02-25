import { describe, test, expect } from "bun:test";
import { FromDb } from "../../../src/operations/input/fromdb.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromDb(args: string[]): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromDb(collector);
  op.init(args);
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

async function runFromDbAsync(args: string[]): Promise<JsonObject[]> {
  const collector = new CollectorReceiver();
  const op = new FromDb(collector);
  op.init(args);
  await op.finish();
  return collector.records.map((r) => r.toJSON());
}

// -- Detect available databases at module load time --

const TEST_ROWS = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  foo: String(i + 1),
}));

const INSERT_SQL = `INSERT INTO recs (id, foo) VALUES ${TEST_ROWS.map((r) => `(${r.id}, '${r.foo}')`).join(", ")}`;

let pgAvailable = false;
try {
  const { Client } = await import("pg");
  const client = new Client({ database: "recs_test" });
  await client.connect();
  await client.query(
    `CREATE TABLE IF NOT EXISTS recs (id INTEGER, foo TEXT)`
  );
  const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM recs");
  if (rows[0].n === 0) {
    await client.query(INSERT_SQL);
  }
  await client.end();
  pgAvailable = true;
} catch {
  // pg not available — tests will be skipped
}

let mysqlAvailable = false;
try {
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    database: "recs_test",
  });
  await conn.execute(
    `CREATE TABLE IF NOT EXISTS recs (id INTEGER, foo VARCHAR(255))`
  );
  const [countRows] = await conn.execute("SELECT COUNT(*) AS n FROM recs");
  if ((countRows as Array<{ n: number }>)[0]!.n === 0) {
    await conn.execute(INSERT_SQL);
  }
  await conn.end();
  mysqlAvailable = true;
} catch {
  // mysql not available — tests will be skipped
}

// -- SQLite tests (always run) --

describe("FromDb", () => {
  test("dump entire table", () => {
    const result = runFromDb([
      "--dbfile",
      "tests/fixtures/sqliteDB",
      "--table",
      "recs",
    ]);

    expect(result.length).toBe(10);
    expect(result[0]).toEqual({ id: 1, foo: "1" });
    expect(result[9]).toEqual({ id: 10, foo: "10" });
  });

  test("run SQL query with WHERE clause", () => {
    const result = runFromDb([
      "--dbfile",
      "tests/fixtures/sqliteDB",
      "--sql",
      "select * from recs where foo > 5",
    ]);

    expect(result.length).toBe(4);
    expect(result[0]).toEqual({ id: 6, foo: "6" });
    expect(result[3]).toEqual({ id: 9, foo: "9" });
  });

  test("requires --table or --sql", () => {
    expect(() => {
      const op = new FromDb();
      op.init(["--dbfile", "test.db"]);
    }).toThrow("Must define --table or --sql");
  });

  test("wantsInput returns false", () => {
    const op = new FromDb();
    op.init(["--dbfile", "test.db", "--table", "t"]);
    expect(op.wantsInput()).toBe(false);
  });
});

// -- Option validation tests (always run, no DB needed) --

describe("FromDb option validation", () => {
  test("requires --db for pg type", () => {
    expect(() => {
      const op = new FromDb();
      op.init(["--type", "pg", "--table", "recs"]);
    }).toThrow("--db is required for PostgreSQL databases");
  });

  test("requires --host and --db for mysql type", () => {
    expect(() => {
      const op = new FromDb();
      op.init(["--type", "mysql", "--table", "recs"]);
    }).toThrow("--host and --db are required for MySQL databases");
  });

  test("requires --host for mysql type (--db alone insufficient)", () => {
    expect(() => {
      const op = new FromDb();
      op.init(["--type", "mysql", "--db", "mydb", "--table", "recs"]);
    }).toThrow("--host and --db are required for MySQL databases");
  });

  test("requires --db for oracle type", () => {
    expect(() => {
      const op = new FromDb();
      op.init(["--type", "oracle", "--table", "recs"]);
    }).toThrow("--db (tnsname) is required for Oracle databases");
  });

  test("rejects unsupported --type", async () => {
    const collector = new CollectorReceiver();
    const op = new FromDb(collector);
    op.init(["--type", "bogus", "--table", "t", "--db", "x"]);
    await expect(op.finish()).rejects.toThrow("not supported");
  });
});

// -- PostgreSQL integration tests (skipped if pg unavailable) --

describe.skipIf(!pgAvailable)("FromDb PostgreSQL", () => {
  test("dump entire table via --type pg", async () => {
    const result = await runFromDbAsync([
      "--type", "pg",
      "--db", "recs_test",
      "--table", "recs",
    ]);

    expect(result.length).toBe(10);
    expect(result[0]).toEqual({ id: 1, foo: "1" });
    expect(result[9]).toEqual({ id: 10, foo: "10" });
  });

  test("run SQL query with WHERE clause", async () => {
    const result = await runFromDbAsync([
      "--type", "pg",
      "--db", "recs_test",
      "--sql", "SELECT * FROM recs WHERE id > 6 ORDER BY id",
    ]);

    expect(result.length).toBe(4);
    expect(result[0]).toEqual({ id: 7, foo: "7" });
    expect(result[3]).toEqual({ id: 10, foo: "10" });
  });

  test("connects via Unix socket by default (no --host)", async () => {
    const result = await runFromDbAsync([
      "--type", "pg",
      "--db", "recs_test",
      "--sql", "SELECT 1 AS val",
    ]);

    expect(result).toEqual([{ val: 1 }]);
  });

  test("supports --port option", async () => {
    const result = await runFromDbAsync([
      "--type", "pg",
      "--db", "recs_test",
      "--port", "5432",
      "--sql", "SELECT 1 AS val",
    ]);

    expect(result).toEqual([{ val: 1 }]);
  });
});

// -- MySQL integration tests (skipped if mysql unavailable) --

describe.skipIf(!mysqlAvailable)("FromDb MySQL", () => {
  test("dump entire table via --type mysql", async () => {
    const result = await runFromDbAsync([
      "--type", "mysql",
      "--host", "127.0.0.1",
      "--db", "recs_test",
      "--user", "root",
      "--table", "recs",
    ]);

    expect(result.length).toBe(10);
    expect(result[0]).toEqual({ id: 1, foo: "1" });
    expect(result[9]).toEqual({ id: 10, foo: "10" });
  });

  test("run SQL query with WHERE clause", async () => {
    const result = await runFromDbAsync([
      "--type", "mysql",
      "--host", "127.0.0.1",
      "--db", "recs_test",
      "--user", "root",
      "--sql", "SELECT * FROM recs WHERE id > 6 ORDER BY id",
    ]);

    expect(result.length).toBe(4);
    expect(result[0]).toEqual({ id: 7, foo: "7" });
    expect(result[3]).toEqual({ id: 10, foo: "10" });
  });

  test("supports --port option", async () => {
    const result = await runFromDbAsync([
      "--type", "mysql",
      "--host", "127.0.0.1",
      "--port", "3306",
      "--db", "recs_test",
      "--user", "root",
      "--sql", "SELECT 1 AS val",
    ]);

    expect(result[0]).toHaveProperty("val", 1);
  });
});
