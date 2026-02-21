import { describe, test, expect } from "bun:test";
import { FromMongo } from "../../../src/operations/input/frommongo.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

describe("FromMongo", () => {
  test("requires all connection parameters", () => {
    expect(() => {
      const op = new FromMongo();
      op.init(["--host", "localhost"]);
    }).toThrow("Must specify all of --host, --name, --collection, and --query");
  });

  test("parses all options correctly", () => {
    const op = new FromMongo();
    // Should not throw
    op.init([
      "--host",
      "mongodb://localhost:27017",
      "--name",
      "testdb",
      "--collection",
      "users",
      "--query",
      '{"active": true}',
    ]);
    expect(op.wantsInput()).toBe(false);
  });

  test("async stream with mock cursor", async () => {
    const collector = new CollectorReceiver();
    const op = new FromMongo(collector);
    op.init([
      "--host",
      "mongodb://localhost:27017",
      "--name",
      "testdb",
      "--collection",
      "users",
      "--query",
      "{}",
    ]);

    // Create an async iterable mock cursor
    const mockData: JsonObject[] = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];

    async function* mockCursor() {
      for (const doc of mockData) {
        yield doc;
      }
    }

    op.setMockCursor(mockCursor());
    await op.streamDoneAsync();
    op.finish();

    const result = collector.records.map((r) => r.toJSON());
    expect(result).toEqual([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
  });

  test("relaxed JSON parsing", () => {
    // Should accept bare key names and single quotes
    const op = new FromMongo();
    op.init([
      "--host",
      "mongodb://localhost",
      "--name",
      "db",
      "--collection",
      "coll",
      "--query",
      "{active: true}",
    ]);
    // If it parsed without error, we're good
    expect(op.wantsInput()).toBe(false);
  });
});
