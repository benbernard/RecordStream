import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { Database } from "bun:sqlite";
import type { JsonObject, JsonValue } from "../../types/json.ts";

/**
 * Execute SQL queries and produce records from results.
 *
 * Analogous to App::RecordStream::Operation::fromdb in Perl.
 */
export class FromDb extends Operation {
  tableName: string | null = null;
  sql: string | null = null;
  dbFile: string | null = null;
  dbType = "sqlite";

  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "table",
        type: "string",
        handler: (v) => {
          this.tableName = v as string;
        },
        description: "Table name (shortcut for SELECT * FROM table)",
      },
      {
        long: "sql",
        type: "string",
        handler: (v) => {
          this.sql = v as string;
        },
        description: "SQL select statement to run",
      },
      {
        long: "dbfile",
        type: "string",
        handler: (v) => {
          this.dbFile = v as string;
        },
        description: "Path to the database file",
      },
      {
        long: "type",
        type: "string",
        handler: (v) => {
          this.dbType = v as string;
        },
        description: "Database type (default: sqlite)",
      },
    ];

    this.parseOptions(args, defs);

    if (!this.tableName && !this.sql) {
      throw new Error("Must define --table or --sql");
    }

    if (!this.sql) {
      this.sql = `SELECT * FROM ${this.tableName}`;
    }
  }

  override wantsInput(): boolean {
    return false;
  }

  override streamDone(): void {
    if (this.dbType !== "sqlite") {
      throw new Error(
        `Database type '${this.dbType}' is not supported yet. Only sqlite is currently supported.`
      );
    }

    if (!this.dbFile) {
      throw new Error("--dbfile is required for sqlite databases");
    }

    const db = new Database(this.dbFile, { readonly: true });

    try {
      const stmt = db.prepare(this.sql!);
      const rows = stmt.all() as JsonObject[];

      for (const row of rows) {
        const record: JsonObject = {};
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === "bigint") {
            record[key] = Number(value);
          } else {
            record[key] = value as JsonValue;
          }
        }
        this.pushRecord(new Record(record));
      }
    } finally {
      db.close();
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromdb",
  category: "input",
  synopsis: "recs fromdb [options]",
  description:
    "Execute a select statement on a database and create a record stream from the results. The keys of the record will be the column names and the values the row values.",
  options: [
    {
      flags: ["--table"],
      argument: "<table>",
      description: "Table name (shortcut for SELECT * FROM table).",
    },
    {
      flags: ["--sql"],
      argument: "<statement>",
      description: "SQL select statement to run.",
    },
    {
      flags: ["--dbfile"],
      argument: "<path>",
      description: "Path to the database file.",
    },
    {
      flags: ["--type"],
      argument: "<dbtype>",
      description: "Database type (default: sqlite).",
    },
  ],
  examples: [
    {
      description: "Dump a table",
      command: "recs fromdb --type sqlite --dbfile testDb --table recs",
    },
    {
      description: "Run a select statement",
      command: "recs fromdb --dbfile testDb --sql 'SELECT * FROM recs WHERE id > 9'",
    },
  ],
};
