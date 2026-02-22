import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * Query MongoDB and produce records from results.
 *
 * Analogous to App::RecordStream::Operation::frommongo in Perl.
 *
 * Note: This implementation requires the 'mongodb' package to be installed.
 * Install with: bun add mongodb
 */
export class FromMongo extends Operation {
  host: string | null = null;
  user: string | null = null;
  password: string | null = null;
  dbName: string | null = null;
  collection: string | null = null;
  query: JsonObject = {};

  // For testing - allows injecting a mock cursor
  mockCursor: AsyncIterable<JsonObject> | null = null;

  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "host",
        type: "string",
        handler: (v) => {
          this.host = v as string;
        },
        description: "URI for your mongo instance",
      },
      {
        long: "user",
        type: "string",
        handler: (v) => {
          this.user = v as string;
        },
        description: "User to authenticate as",
      },
      {
        long: "password",
        type: "string",
        handler: (v) => {
          this.password = v as string;
        },
        description: "Password for --user",
      },
      {
        long: "pass",
        type: "string",
        handler: (v) => {
          this.password = v as string;
        },
        description: "Password for --user",
      },
      {
        long: "name",
        type: "string",
        handler: (v) => {
          this.dbName = v as string;
        },
        description: "Database name",
      },
      {
        long: "dbname",
        type: "string",
        handler: (v) => {
          this.dbName = v as string;
        },
        description: "Database name",
      },
      {
        long: "collection",
        type: "string",
        handler: (v) => {
          this.collection = v as string;
        },
        description: "Collection name",
      },
      {
        long: "query",
        type: "string",
        handler: (v) => {
          // Parse relaxed JSON (allow bare keys, single quotes, trailing commas)
          this.query = parseRelaxedJson(v as string);
        },
        description: "JSON query string",
      },
    ];

    this.parseOptions(args, defs);

    if (!this.host || !this.dbName || !this.collection || !this.query) {
      throw new Error(
        "Must specify all of --host, --name, --collection, and --query"
      );
    }
  }

  setMockCursor(cursor: AsyncIterable<JsonObject>): void {
    this.mockCursor = cursor;
  }

  override wantsInput(): boolean {
    return false;
  }

  override streamDone(): void {
    // MongoDB operations are inherently async - see streamDoneAsync
    // For sync operation, we use a workaround
    if (this.mockCursor) {
      // For testing with sync mock
      return;
    }
    // In real usage, this should be called via the async pipeline
    console.error(
      "Warning: frommongo requires async execution. Use the async pipeline API."
    );
  }

  /**
   * Async version of streamDone for use in async pipelines.
   */
  async streamDoneAsync(): Promise<void> {
    if (this.mockCursor) {
      for await (const doc of this.mockCursor) {
        this.pushRecord(new Record(sanitizeMongoDoc(doc)));
      }
      return;
    }

    // Dynamically import mongodb (optional dependency, not bundled)
    const { MongoClient } = await import("mongodb");

    let uri = this.host!;
    if (this.user && this.password) {
      // Insert credentials if not already in URI
      if (!uri.includes("@")) {
        uri = uri.replace(
          "mongodb://",
          `mongodb://${this.user}:${this.password}@`
        );
      }
    }

    const client = new MongoClient(uri);
    try {
      await client.connect();
      const db = client.db(this.dbName!);
      const coll = db.collection(this.collection!);
      const cursor = coll.find(this.query);

      for await (const doc of cursor) {
        this.pushRecord(new Record(sanitizeMongoDoc(doc as unknown as JsonObject)));
      }
    } finally {
      await client.close();
    }
  }
}

/**
 * Convert MongoDB document to plain JSON object.
 * Removes _id ObjectId and converts special types.
 */
function sanitizeMongoDoc(doc: JsonObject): JsonObject {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "_id" && typeof value === "object" && value !== null) {
      // Convert ObjectId to string
      result[key] = String(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Parse relaxed JSON similar to how Perl's JSON::PP->new()->allow_barekey() works.
 * Handles bare keys, single quotes, and trailing commas.
 */
function parseRelaxedJson(input: string): JsonObject {
  // Try standard JSON first
  try {
    return JSON.parse(input) as JsonObject;
  } catch {
    // Fall back to relaxed parsing
  }

  // Simple relaxed parser: convert bare keys to quoted keys
  let normalized = input
    // Convert single quotes to double quotes
    .replace(/'/g, '"')
    // Add quotes around bare keys (words followed by :)
    .replace(/(\{|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
    // Remove trailing commas before } or ]
    .replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(normalized) as JsonObject;
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "frommongo",
  category: "input",
  synopsis: "recs frommongo --host <URI> --name <DB> --collection <COLL> --query <QUERY>",
  description:
    "Generate records from a MongoDB query. Connects to a MongoDB instance, runs the specified query against the given collection, and outputs each matching document as a record.",
  options: [
    {
      flags: ["--host"],
      argument: "<HOST_URI>",
      description: "URI for your mongo instance, may include user:pass@URI.",
      required: true,
    },
    {
      flags: ["--user"],
      argument: "<USER>",
      description: "User to authenticate as.",
    },
    {
      flags: ["--password", "--pass"],
      argument: "<PASSWORD>",
      description: "Password for --user.",
    },
    {
      flags: ["--name", "--dbname"],
      argument: "<DB_NAME>",
      description: "Name of database to connect to.",
      required: true,
    },
    {
      flags: ["--collection"],
      argument: "<COLLECTION_NAME>",
      description: "Name of collection to query against.",
      required: true,
    },
    {
      flags: ["--query"],
      argument: "<QUERY>",
      description: "JSON query string to run against the collection.",
      required: true,
    },
  ],
  examples: [
    {
      description: "Make a query against a MongoDB instance",
      command:
        "recs frommongo --host mongodb://user:pass@dharma.mongohq.com:10069 --name my_app --collection my_collection --query '{doc_key: {$not: {$size: 0}}}'",
    },
  ],
};
