# fromdb

Query a database and produce records from the result rows.

## Synopsis

```bash
recs fromdb [options]
```

## Description

`fromdb` executes a SQL SELECT statement against a database and emits one record per result row. The record keys are the column names and the values are the row values. It is the fastest way to get structured data out of a database and into a recs pipeline.

The TypeScript implementation currently supports SQLite databases via Bun's built-in SQLite driver. This means zero external dependencies for local database work -- just point it at a `.db` or `.sqlite` file and go. The original Perl implementation also supports MySQL, PostgreSQL, and Oracle; support for those may be added in the future.

You can either dump an entire table with `--table` (which is shorthand for `SELECT * FROM tableName`) or run an arbitrary SQL query with `--sql`. The latter is more flexible and lets you filter, join, and aggregate at the database level before the data even enters your pipeline.

## Options

| Flag | Description |
|------|-------------|
| `--table <name>` | Name of the table to dump. Shortcut for `--sql 'SELECT * FROM name'`. |
| `--sql <query>` | SQL SELECT statement to execute. |
| `--dbfile <path>` | Path to the SQLite database file. Required for SQLite databases. |
| `--type <dbtype>` | Database type. Default is `sqlite`. Currently only `sqlite` is supported in the TS implementation. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename. |

One of `--table` or `--sql` must be specified.

## Examples

### Dump an entire table
```bash
recs fromdb --dbfile app.db --table users
```

### Run a filtered query
```bash
recs fromdb --dbfile app.db --sql 'SELECT name, email FROM users WHERE active = 1'
```

### Join tables at the database level, then process with recs
```bash
recs fromdb --dbfile shop.db \
  --sql 'SELECT o.id, o.total, c.name FROM orders o JOIN customers c ON o.customer_id = c.id' \
  | recs collate --key name --aggregator 'sum(total)'
```

### Query with aggregation in SQL
```bash
recs fromdb --dbfile metrics.db \
  --sql 'SELECT host, COUNT(*) as error_count FROM events WHERE level = "ERROR" GROUP BY host' \
  | recs sort --key error_count=-n
```

## Notes

- The database is opened in read-only mode, so you cannot accidentally modify data through this command.
- BigInt values from SQLite are automatically converted to JavaScript numbers.
- For writing records into a database, see `todb`.

## See Also

- [todb](./todb) - Insert records into a SQLite database
- [fromcsv](./fromcsv) - Parse CSV files (an alternative to database export)
- [fromjsonarray](./fromjsonarray) - Parse JSON data dumps
