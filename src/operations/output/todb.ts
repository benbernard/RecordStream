import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { findKey } from "../../KeySpec.ts";
import type { JsonValue } from "../../types/json.ts";

/**
 * Writes records to a SQL database.
 * Supports SQLite (via bun:sqlite), with extensibility for other databases.
 *
 * Analogous to App::RecordStream::Operation::todb in Perl.
 */
export class ToDb extends Operation {
  tableName = "recs";
  debug = false;
  dropTable = false;
  fields: Map<string, string> = new Map(); // field name -> SQL type (0 = default VARCHAR)
  first = true;
  dbFile = "";
  dbType = "sqlite";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Database instance type depends on runtime
  db: { run: (sql: string) => void; close: () => void } | null = null;

  constructor(next?: RecordReceiver) {
    super(next);
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "drop",
        type: "boolean",
        handler: () => { this.dropTable = true; },
        description: "Drop the table before running create/insert",
      },
      {
        long: "table",
        type: "string",
        handler: (v) => { this.tableName = v as string; },
        description: "Name of the table (default: recs)",
      },
      {
        long: "debug",
        type: "boolean",
        handler: () => { this.debug = true; },
        description: "Print all executed SQL",
      },
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => {
          for (const spec of (v as string).split(",")) {
            const eqIdx = spec.indexOf("=");
            if (eqIdx >= 0) {
              this.fields.set(spec.slice(0, eqIdx), spec.slice(eqIdx + 1));
            } else {
              this.fields.set(spec, "");
            }
          }
        },
        description: "Fields to insert (fieldName or fieldName=SQL_TYPE)",
      },
      {
        long: "fields",
        short: "f",
        type: "string",
        handler: (v) => {
          for (const spec of (v as string).split(",")) {
            const eqIdx = spec.indexOf("=");
            if (eqIdx >= 0) {
              this.fields.set(spec.slice(0, eqIdx), spec.slice(eqIdx + 1));
            } else {
              this.fields.set(spec, "");
            }
          }
        },
        description: "Fields to insert (fieldName or fieldName=SQL_TYPE)",
      },
      {
        long: "dbfile",
        type: "string",
        handler: (v) => { this.dbFile = v as string; },
        description: "Database file path (for SQLite)",
      },
      {
        long: "type",
        type: "string",
        handler: (v) => { this.dbType = v as string; },
        description: "Database type (sqlite)",
      },
    ];

    this.parseOptions(args, defs);

    if (!this.dbFile) {
      this.dbFile = ":memory:";
    }

    this.initDb();

    if (this.dropTable) {
      try {
        this.dbDo(`DROP TABLE IF EXISTS "${this.tableName}"`);
      } catch {
        // Ignore errors from dropping a non-existent table
      }
    }
  }

  initDb(): void {
    // Use Bun's built-in SQLite
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- bun:sqlite is a runtime module
    const { Database } = require("bun:sqlite") as { Database: new (path: string) => { run: (sql: string) => void; close: () => void } };
    this.db = new Database(this.dbFile);
  }

  acceptRecord(record: Record): boolean {
    if (this.first) {
      this.addFields(record);
      this.createTable();
      this.first = false;
    }

    this.addRow(record);
    return true;
  }

  addFields(record: Record): void {
    if (this.fields.size > 0) return;

    for (const key of record.keys()) {
      this.fields.set(key, "");
    }
  }

  addRow(record: Record): void {
    const data = record.dataRef();
    const keys = [...this.fields.keys()];
    const columns = keys.map((k) => `"${k}"`).join(",");
    const values = keys.map((key) => {
      const fieldType = this.fields.get(key)!;
      const val = findKey(data, key, true);
      let strVal = formatDbValue(val);
      if (!fieldType) {
        // Default VARCHAR(255) truncation
        strVal = strVal.slice(0, 255);
      }
      return `'${strVal.replace(/'/g, "''")}'`;
    }).join(",");

    const sql = `INSERT INTO "${this.tableName}" (${columns}) VALUES (${values})`;
    this.dbDo(sql);
  }

  createTable(): void {
    const incrementName = this.dbType === "sqlite" ? "AUTOINCREMENT" : "AUTO_INCREMENT";
    let sql = `CREATE TABLE IF NOT EXISTS "${this.tableName}" ( id INTEGER PRIMARY KEY ${incrementName}, `;

    const columnDefs: string[] = [];
    for (const [name, type] of this.fields) {
      const sqlType = type || "VARCHAR(255)";
      columnDefs.push(`"${name}" ${sqlType}`);
    }

    sql += columnDefs.join(", ") + " )";

    try {
      this.dbDo(sql);
    } catch {
      // Table may already exist
    }
  }

  dbDo(sql: string): void {
    if (this.debug) {
      this.pushLine("Running: " + sql);
    }
    this.db?.run(sql);
  }

  override streamDone(): void {
    this.db?.close();
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs-todb <options> [<files>]
   Dumps a stream of input records into a database.

Arguments:
  --drop                Drop the table before create/insert
  --table <name>        Table name (default: recs)
  --debug               Print all executed SQL
  --key|-k <fields>     Fields to insert (name or name=SQL_TYPE)
  --dbfile <path>       Database file path (for SQLite)
  --type <type>         Database type (sqlite)

Examples:
   # Put all records into the recs table
   recs-todb --type sqlite --dbfile testDb --table recs

   # Specify fields and drop existing table
   recs-todb --dbfile testDb --drop --key status,description=TEXT --key user`;
  }
}

function formatDbValue(val: JsonValue | undefined): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "todb",
  category: "output",
  synopsis: "recs todb [options] [files...]",
  description:
    "Dumps a stream of input records into a database. The record fields you want inserted should have the same keys as the column names in the database, and the records should be key-value pairs. This command will attempt to create the table if it is not already present.",
  options: [
    {
      flags: ["--drop"],
      description: "Drop the table before running create/insert commands.",
    },
    {
      flags: ["--table"],
      argument: "<name>",
      description: "Name of the table to work with (default: 'recs').",
    },
    {
      flags: ["--debug"],
      description: "Print all the executed SQL.",
    },
    {
      flags: ["--key", "-k"],
      argument: "<fields>",
      description:
        "Fields to insert. Can be a name or a name=SQL_TYPE pair. If any fields are specified, they will be the only fields put into the db. May be specified multiple times or comma separated. Type defaults to VARCHAR(255).",
    },
    {
      flags: ["--fields", "-f"],
      argument: "<fields>",
      description:
        "Fields to insert. Can be a name or a name=SQL_TYPE pair. Alias for --key.",
    },
    {
      flags: ["--dbfile"],
      argument: "<path>",
      description: "Database file path (for SQLite).",
    },
    {
      flags: ["--type"],
      argument: "<type>",
      description: "Database type (sqlite).",
    },
  ],
  examples: [
    {
      description: "Put all records into the recs table",
      command: "recs todb --type sqlite --dbfile testDb --table recs",
    },
    {
      description: "Specify fields and drop existing table",
      command: "recs todb --dbfile testDb --drop --key status,description=TEXT --key user",
    },
  ],
  seeAlso: ["fromdb"],
};
