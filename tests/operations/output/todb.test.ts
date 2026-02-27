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

  describe("multi-DB option parsing", () => {
    test("--type pg sets dbType to pg", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      // pg requires --db, so provide it (won't actually connect)
      expect(() => op.init(["--type", "pg", "--db", "testdb"])).not.toThrow();
      expect(op.dbType).toBe("pg");
      expect(op.dbName).toBe("testdb");
    });

    test("--type postgres normalizes to pg", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      expect(() => op.init(["--type", "postgres", "--db", "testdb"])).not.toThrow();
      expect(op.dbType).toBe("pg");
    });

    test("--type pg requires --db", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      expect(() => op.init(["--type", "pg"])).toThrow("--db is required for PostgreSQL");
    });

    test("--type mysql requires --host and --db", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      expect(() => op.init(["--type", "mysql"])).toThrow("--host and --db are required for MySQL");
    });

    test("--type mysql with --db but no --host throws", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      expect(() => op.init(["--type", "mysql", "--db", "testdb"])).toThrow("--host and --db are required for MySQL");
    });

    test("--type mysql accepts required options", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      expect(() => op.init(["--type", "mysql", "--host", "localhost", "--db", "testdb"])).not.toThrow();
      expect(op.dbType).toBe("mysql");
      expect(op.host).toBe("localhost");
      expect(op.dbName).toBe("testdb");
    });

    test("parses all connection options", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init([
        "--type", "pg",
        "--host", "db.example.com",
        "--port", "5432",
        "--db", "mydb",
        "--user", "admin",
        "--password", "secret",
        "--table", "users",
      ]);

      expect(op.dbType).toBe("pg");
      expect(op.host).toBe("db.example.com");
      expect(op.port).toBe("5432");
      expect(op.dbName).toBe("mydb");
      expect(op.user).toBe("admin");
      expect(op.password).toBe("secret");
      expect(op.tableName).toBe("users");
    });

    test("--dbname is alias for --db", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init(["--type", "pg", "--dbname", "testdb"]);
      expect(op.dbName).toBe("testdb");
    });

    test("defaults to sqlite when no --type specified", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init(["--dbfile", ":memory:"]);
      expect(op.dbType).toBe("sqlite");
    });

    test("sqlite defaults dbfile to :memory:", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init([]);
      expect(op.dbFile).toBe(":memory:");
    });

    test("pg buffers records for async flush", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init(["--type", "pg", "--db", "testdb"]);

      op.acceptRecord(new Record({ name: "Alice" }));
      op.acceptRecord(new Record({ name: "Bob" }));

      expect(op.pendingRecords.length).toBe(2);
      // db should not be initialized for pg (it's async)
      expect(op.db).toBeNull();
    });

    test("mysql buffers records for async flush", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init(["--type", "mysql", "--host", "localhost", "--db", "testdb"]);

      op.acceptRecord(new Record({ name: "Alice" }));
      expect(op.pendingRecords.length).toBe(1);
      expect(op.db).toBeNull();
    });

    test("unsupported db type throws on finish", async () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      // Manually set an unsupported type after init to bypass validation
      op.init(["--dbfile", ":memory:"]);
      op.dbType = "oracle";
      op.pendingRecords.push(new Record({ x: 1 }));

      try {
        await op.streamDoneAsync();
        expect(true).toBe(false); // Should not reach here
      } catch (e: unknown) {
        expect((e as Error).message).toContain("not supported");
      }
    });
  });

  describe("SQL generation for different DB types", () => {
    test("sqlite uses AUTOINCREMENT in CREATE TABLE", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init(["--dbfile", ":memory:", "--debug", "--key", "name"]);

      op.acceptRecord(new Record({ name: "Alice" }));
      op.finish();

      const output = collector.output();
      expect(output).toContain("AUTOINCREMENT");
      expect(output).not.toContain("AUTO_INCREMENT");
    });

    test("pg uses GENERATED ALWAYS AS IDENTITY in CREATE TABLE", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init(["--type", "pg", "--db", "testdb", "--key", "name"]);

      // Manually test buildCreateTableSql without connecting
      const sql = op.buildCreateTableSql();
      expect(sql).toContain("GENERATED ALWAYS AS IDENTITY");
      expect(sql).not.toContain("AUTOINCREMENT");
    });

    test("mysql uses AUTO_INCREMENT in CREATE TABLE", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init(["--type", "mysql", "--host", "localhost", "--db", "testdb", "--key", "name"]);

      const sql = op.buildCreateTableSql();
      expect(sql).toContain("AUTO_INCREMENT");
      expect(sql).not.toContain("AUTOINCREMENT");
    });

    test("buildInsertSql generates correct SQL", () => {
      const collector = new LineCollector();
      const op = new ToDb(collector);
      op.init(["--type", "pg", "--db", "testdb", "--key", "name,age=INTEGER"]);

      const sql = op.buildInsertSql(new Record({ name: "Alice", age: 30 }));
      expect(sql).toContain('INSERT INTO "recs"');
      expect(sql).toContain('"name"');
      expect(sql).toContain('"age"');
      expect(sql).toContain("'Alice'");
      expect(sql).toContain("'30'");
    });
  });
});
