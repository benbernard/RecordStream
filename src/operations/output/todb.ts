import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { findKey } from "../../KeySpec.ts";
import type { JsonValue } from "../../types/json.ts";

/**
 * Writes records to a SQL database.
 * Supports SQLite (via bun:sqlite), PostgreSQL (via pg), and MySQL (via mysql2).
 *
 * Analogous to App::RecordStream::Operation::todb in Perl.
 */
export class ToDb extends Operation {
  tableName = "recs";
  debug = false;
  dropTable = false;
  fields: Map<string, string> = new Map(); // field name -> SQL type ("" = default VARCHAR)
  first = true;
  dbFile = "";
  dbType = "sqlite";
  host: string | null = null;
  port: string | null = null;
  dbName: string | null = null;
  user: string | null = null;
  password: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Database instance type depends on runtime
  db: { run: (sql: string) => void; close: () => void } | null = null;
  // Buffered records for async DB types (pg, mysql)
  pendingRecords: Record[] = [];

  constructor(next?: RecordReceiver) {
    super(next);
  }

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
    this.useHelpType("keygroups");
    this.useHelpType("keys");
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
        description: "Database type: sqlite (default), pg, mysql",
      },
      {
        long: "host",
        type: "string",
        handler: (v) => { this.host = v as string; },
        description: "Hostname for database connection (pg, mysql)",
      },
      {
        long: "port",
        type: "string",
        handler: (v) => { this.port = v as string; },
        description: "Port for database connection (pg, mysql)",
      },
      {
        long: "db",
        type: "string",
        handler: (v) => { this.dbName = v as string; },
        description: "Database name (pg, mysql)",
      },
      {
        long: "dbname",
        type: "string",
        handler: (v) => { this.dbName = v as string; },
        description: "Database name (alias for --db)",
      },
      {
        long: "user",
        type: "string",
        handler: (v) => { this.user = v as string; },
        description: "Database user",
      },
      {
        long: "password",
        type: "string",
        handler: (v) => { this.password = v as string; },
        description: "Database password",
      },
    ];

    this.parseOptions(args, defs);

    if (this.dbType === "postgres") {
      this.dbType = "pg";
    }

    if (this.dbType === "pg" && !this.dbName) {
      throw new Error("--db is required for PostgreSQL databases");
    }

    if (this.dbType === "mysql" && (!this.host || !this.dbName)) {
      throw new Error("--host and --db are required for MySQL databases");
    }

    if (this.dbType === "sqlite") {
      if (!this.dbFile) {
        this.dbFile = ":memory:";
      }
      this.initSqliteDb();

      if (this.dropTable) {
        try {
          this.dbDo(`DROP TABLE IF EXISTS "${this.tableName}"`);
        } catch {
          // Ignore errors from dropping a non-existent table
        }
      }
    }
    // For pg/mysql, connection is established asynchronously in finish()
  }

  initSqliteDb(): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- bun:sqlite is a runtime module
    const { Database } = require("bun:sqlite") as { Database: new (path: string) => { run: (sql: string) => void; close: () => void } };
    this.db = new Database(this.dbFile);
  }

  acceptRecord(record: Record): boolean {
    if (this.dbType === "sqlite") {
      if (this.first) {
        this.addFields(record);
        this.createTable();
        this.first = false;
      }
      this.addRow(record);
    } else {
      // Buffer records for async DB types
      this.pendingRecords.push(record);
    }
    return true;
  }

  addFields(record: Record): void {
    if (this.fields.size > 0) return;

    for (const key of record.keys()) {
      this.fields.set(key, "");
    }
  }

  buildInsertSql(record: Record): string {
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

    return `INSERT INTO "${this.tableName}" (${columns}) VALUES (${values})`;
  }

  addRow(record: Record): void {
    const sql = this.buildInsertSql(record);
    this.dbDo(sql);
  }

  buildCreateTableSql(): string {
    const incrementName = this.dbType === "sqlite" ? "AUTOINCREMENT" : (this.dbType === "pg" ? "GENERATED ALWAYS AS IDENTITY" : "AUTO_INCREMENT");

    if (this.dbType === "pg") {
      let sql = `CREATE TABLE IF NOT EXISTS "${this.tableName}" ( id INTEGER ${incrementName} PRIMARY KEY, `;
      const columnDefs: string[] = [];
      for (const [name, type] of this.fields) {
        const sqlType = type || "VARCHAR(255)";
        columnDefs.push(`"${name}" ${sqlType}`);
      }
      sql += columnDefs.join(", ") + " )";
      return sql;
    }

    let sql = `CREATE TABLE IF NOT EXISTS "${this.tableName}" ( id INTEGER PRIMARY KEY ${incrementName}, `;
    const columnDefs: string[] = [];
    for (const [name, type] of this.fields) {
      const sqlType = type || "VARCHAR(255)";
      columnDefs.push(`"${name}" ${sqlType}`);
    }
    sql += columnDefs.join(", ") + " )";
    return sql;
  }

  createTable(): void {
    const sql = this.buildCreateTableSql();
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
    if (this.dbType === "sqlite") {
      this.db?.close();
    }
    // For async types, cleanup happens in streamDoneAsync
  }

  async streamDoneAsync(): Promise<void> {
    switch (this.dbType) {
      case "sqlite":
        this.db?.close();
        break;
      case "pg":
        await this.flushPostgres();
        break;
      case "mysql":
        await this.flushMysql();
        break;
      default:
        throw new Error(
          `Database type '${this.dbType}' is not supported. Supported types: sqlite, pg, mysql`
        );
    }
  }

  /**
   * Override finish to support async database types.
   * The dispatcher and executor both call `await op.finish()`, so returning
   * a Promise here is correctly awaited at runtime even though the base
   * class types this as void.
   */
  override finish(): void {
    if (this.dbType === "sqlite") {
      this.streamDone();
      this.next.finish();
      return;
    }
    // For async types (pg, mysql), return the Promise so the
    // dispatcher's `await op.finish()` waits for it at runtime.
    return this.streamDoneAsync().then(() => {
      this.next.finish();
    }) as unknown as void;
  }

  async flushPostgres(): Promise<void> {
    const { Client } = await import("pg");

    const config: {
      database: string;
      host?: string;
      port?: number;
      user?: string;
      password?: string;
    } = {
      database: this.dbName!,
    };

    if (this.host) {
      config.host = this.host;
    }
    if (this.port) {
      config.port = parseInt(this.port, 10);
    }
    if (this.user) {
      config.user = this.user;
    }
    if (this.password) {
      config.password = this.password;
    }

    const client = new Client(config);
    try {
      await client.connect();

      if (this.dropTable) {
        const dropSql = `DROP TABLE IF EXISTS "${this.tableName}"`;
        if (this.debug) {
          this.pushLine("Running: " + dropSql);
        }
        await client.query(dropSql);
      }

      // Determine fields from first record if not specified
      if (this.pendingRecords.length > 0 && this.fields.size === 0) {
        this.addFields(this.pendingRecords[0]!);
      }

      if (this.fields.size > 0) {
        const createSql = this.buildCreateTableSql();
        if (this.debug) {
          this.pushLine("Running: " + createSql);
        }
        await client.query(createSql);
      }

      for (const record of this.pendingRecords) {
        const sql = this.buildInsertSql(record);
        if (this.debug) {
          this.pushLine("Running: " + sql);
        }
        await client.query(sql);
      }
    } finally {
      await client.end();
    }
  }

  async flushMysql(): Promise<void> {
    const mysql = await import("mysql2/promise");

    const config: {
      host: string;
      database: string;
      port?: number;
      user?: string;
      password?: string;
    } = {
      host: this.host!,
      database: this.dbName!,
    };

    if (this.port) {
      config.port = parseInt(this.port, 10);
    }
    if (this.user) {
      config.user = this.user;
    }
    if (this.password) {
      config.password = this.password;
    }

    const connection = await mysql.createConnection(config);
    try {
      if (this.dropTable) {
        const dropSql = `DROP TABLE IF EXISTS "${this.tableName}"`;
        if (this.debug) {
          this.pushLine("Running: " + dropSql);
        }
        await connection.execute(dropSql);
      }

      // Determine fields from first record if not specified
      if (this.pendingRecords.length > 0 && this.fields.size === 0) {
        this.addFields(this.pendingRecords[0]!);
      }

      if (this.fields.size > 0) {
        const createSql = this.buildCreateTableSql();
        if (this.debug) {
          this.pushLine("Running: " + createSql);
        }
        await connection.execute(createSql);
      }

      for (const record of this.pendingRecords) {
        const sql = this.buildInsertSql(record);
        if (this.debug) {
          this.pushLine("Running: " + sql);
        }
        await connection.execute(sql);
      }
    } finally {
      await connection.end();
    }
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs todb <options> [<files>]
   Dumps a stream of input records into a database.

   Supports SQLite (default), PostgreSQL (--type pg), and MySQL (--type mysql).
   PostgreSQL requires the 'pg' package. MySQL requires the 'mysql2' package.

Arguments:
  --drop                Drop the table before create/insert
  --table <name>        Table name (default: recs)
  --debug               Print all executed SQL
  --key|-k <fields>     Fields to insert (name or name=SQL_TYPE)
  --dbfile <path>       Database file path (for SQLite)
  --type <type>         Database type: sqlite (default), pg, mysql
  --host <hostname>     Hostname for database connection (pg, mysql)
  --port <port>         Port for database connection (pg, mysql)
  --db <database>       Database name (pg, mysql)
  --user <user>         Database user for authentication
  --password <password> Database password for authentication

Examples:
   # Put all records into the recs table (SQLite)
   recs todb --type sqlite --dbfile testDb --table recs

   # Specify fields and drop existing table
   recs todb --dbfile testDb --drop --key status,description=TEXT --key user

   # Insert into PostgreSQL via Unix socket
   recs todb --type pg --db mydb --table users

   # Insert into PostgreSQL with host and credentials
   recs todb --type pg --host db.example.com --port 5432 --db mydb --user admin --password secret

   # Insert into MySQL
   recs todb --type mysql --host localhost --db mydb --user root --table orders`;
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
    "Dumps a stream of input records into a database. The record fields you want inserted should have the same keys as the column names in the database, and the records should be key-value pairs. This command will attempt to create the table if it is not already present.\n\nSupports SQLite (default), PostgreSQL (--type pg), and MySQL (--type mysql).\n\nPostgreSQL requires the 'pg' package. MySQL requires the 'mysql2' package.",
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
      description: "Database type: sqlite (default), pg, mysql.",
    },
    {
      flags: ["--host"],
      argument: "<hostname>",
      description:
        "Hostname for database connection. For pg, omit to use Unix domain socket. Required for mysql.",
    },
    {
      flags: ["--port"],
      argument: "<port>",
      description: "Port for database connection (pg, mysql).",
    },
    {
      flags: ["--db", "--dbname"],
      argument: "<database>",
      description: "Database name. Required for pg and mysql.",
    },
    {
      flags: ["--user"],
      argument: "<user>",
      description: "Database user for authentication.",
    },
    {
      flags: ["--password"],
      argument: "<password>",
      description: "Database password for authentication.",
    },
  ],
  examples: [
    {
      description: "Put all records into the recs table (SQLite)",
      command: "recs todb --type sqlite --dbfile testDb --table recs",
    },
    {
      description: "Specify fields and drop existing table",
      command: "recs todb --dbfile testDb --drop --key status,description=TEXT --key user",
    },
    {
      description: "Insert into PostgreSQL via Unix socket",
      command: "recs todb --type pg --db mydb --table users",
    },
    {
      description: "Insert into PostgreSQL with credentials",
      command:
        "recs todb --type pg --host db.example.com --port 5432 --db mydb --user admin --password secret",
    },
    {
      description: "Insert into MySQL",
      command:
        "recs todb --type mysql --host localhost --db mydb --user root --table orders",
    },
  ],
  seeAlso: ["fromdb"],
};
