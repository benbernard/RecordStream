import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { Database } from "bun:sqlite";
import type { JsonObject, JsonValue } from "../../types/json.ts";

/**
 * Execute SQL queries and produce records from results.
 *
 * Supports SQLite (default) and PostgreSQL (--type pg).
 *
 * Analogous to App::RecordStream::Operation::fromdb in Perl.
 */
export class FromDb extends Operation {
  tableName: string | null = null;
  sql: string | null = null;
  dbFile: string | null = null;
  dbType = "sqlite";
  host: string | null = null;
  port: string | null = null;
  dbName: string | null = null;
  user: string | null = null;
  password: string | null = null;

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
        description: "Path to the database file (sqlite)",
      },
      {
        long: "type",
        type: "string",
        handler: (v) => {
          this.dbType = v as string;
        },
        description: "Database type: sqlite (default), pg, mysql, oracle",
      },
      {
        long: "host",
        type: "string",
        handler: (v) => {
          this.host = v as string;
        },
        description: "Hostname for database connection (pg, mysql)",
      },
      {
        long: "port",
        type: "string",
        handler: (v) => {
          this.port = v as string;
        },
        description: "Port for database connection (pg, mysql)",
      },
      {
        long: "db",
        type: "string",
        handler: (v) => {
          this.dbName = v as string;
        },
        description: "Database name (pg, mysql, oracle tnsname)",
      },
      {
        long: "dbname",
        type: "string",
        handler: (v) => {
          this.dbName = v as string;
        },
        description: "Database name (alias for --db)",
      },
      {
        long: "user",
        type: "string",
        handler: (v) => {
          this.user = v as string;
        },
        description: "Database user",
      },
      {
        long: "password",
        type: "string",
        handler: (v) => {
          this.password = v as string;
        },
        description: "Database password",
      },
    ];

    this.parseOptions(args, defs);

    if (!this.tableName && !this.sql) {
      throw new Error("Must define --table or --sql");
    }

    if (!this.sql) {
      this.sql = `SELECT * FROM ${this.tableName}`;
    }

    if (this.dbType === "pg" && !this.dbName) {
      throw new Error("--db is required for PostgreSQL databases");
    }

    if (this.dbType === "mysql" && (!this.host || !this.dbName)) {
      throw new Error("--host and --db are required for MySQL databases");
    }

    if (this.dbType === "oracle" && !this.dbName) {
      throw new Error("--db (tnsname) is required for Oracle databases");
    }
  }

  override wantsInput(): boolean {
    return false;
  }

  override streamDone(): void {
    if (this.dbType === "sqlite") {
      this.runSqlite();
    }
    // pg, mysql, oracle are async - handled via streamDoneAsync in finish()
  }

  async streamDoneAsync(): Promise<void> {
    switch (this.dbType) {
      case "sqlite":
        this.runSqlite();
        break;
      case "pg":
        await this.runPostgres();
        break;
      case "mysql":
        await this.runMysql();
        break;
      case "oracle":
        await this.runOracle();
        break;
      default:
        throw new Error(
          `Database type '${this.dbType}' is not supported. Supported types: sqlite, pg, mysql, oracle`
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
    // For async types (pg, mysql, oracle), return the Promise so the
    // dispatcher's `await op.finish()` waits for it at runtime.
    return this.streamDoneAsync().then(() => {
      this.next.finish();
    }) as unknown as void;
  }

  runSqlite(): void {
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

  async runPostgres(): Promise<void> {
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

    // When --host is NOT provided, leave it unset so the driver uses Unix domain socket
    if (this.host) {
      config.host = this.host;
    }

    // Only include port when explicitly provided
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
      const result = await client.query(this.sql!);

      for (const row of result.rows) {
        this.pushRecord(new Record(row as JsonObject));
      }
    } finally {
      await client.end();
    }
  }

  async runMysql(): Promise<void> {
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
      const [rows] = await connection.execute(this.sql!);

      for (const row of rows as JsonObject[]) {
        this.pushRecord(new Record(row));
      }
    } finally {
      await connection.end();
    }
  }

  async runOracle(): Promise<void> {
    let oracledb;
    try {
      oracledb = await import("oracledb");
    } catch {
      throw new Error(
        "Oracle support requires the 'oracledb' package. Install with: bun add oracledb"
      );
    }

    const config: {
      connectString: string;
      user?: string;
      password?: string;
    } = {
      connectString: this.dbName!,
    };

    if (this.user) {
      config.user = this.user;
    }

    if (this.password) {
      config.password = this.password;
    }

    const connection = await oracledb.default.getConnection(config);
    try {
      const result = await connection.execute(this.sql!, [], {
        outFormat: oracledb.default.OUT_FORMAT_OBJECT,
      });

      if (result.rows) {
        for (const row of result.rows) {
          this.pushRecord(new Record(row as JsonObject));
        }
      }
    } finally {
      await connection.close();
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromdb",
  category: "input",
  synopsis: "recs fromdb [options]",
  description:
    "Execute a select statement on a database and create a record stream from the results. The keys of the record will be the column names and the values the row values.\n\nSupports SQLite (default), PostgreSQL (--type pg), MySQL (--type mysql), and Oracle (--type oracle).\n\nPostgreSQL and MySQL require the 'pg' and 'mysql2' packages respectively. Oracle requires the 'oracledb' package (optional, install with: bun add oracledb).",
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
      description: "Path to the database file (sqlite).",
    },
    {
      flags: ["--type"],
      argument: "<dbtype>",
      description:
        "Database type: sqlite (default), pg, mysql, oracle.",
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
      description:
        "Database name. Required for pg, mysql. For oracle, this is the TNS name.",
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
      description: "Dump a SQLite table",
      command: "recs fromdb --type sqlite --dbfile testDb --table recs",
    },
    {
      description: "Run a SQLite select statement",
      command:
        "recs fromdb --dbfile testDb --sql 'SELECT * FROM recs WHERE id > 9'",
    },
    {
      description: "Query PostgreSQL via Unix socket",
      command: "recs fromdb --type pg --db mydb --table users",
    },
    {
      description: "Query PostgreSQL with host and credentials",
      command:
        "recs fromdb --type pg --host db.example.com --port 5432 --db mydb --user admin --password secret --sql 'SELECT * FROM users'",
    },
    {
      description: "Query MySQL",
      command:
        "recs fromdb --type mysql --host localhost --db mydb --user root --table orders",
    },
    {
      description: "Query Oracle",
      command:
        "recs fromdb --type oracle --db MYDB --user scott --password tiger --table emp",
    },
  ],
};
