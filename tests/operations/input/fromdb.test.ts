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
