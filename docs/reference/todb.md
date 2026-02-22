# todb

Insert records into a SQLite database.

## Synopsis

```bash
recs todb [options] [files...]
```

## Description

The `todb` command takes a record stream and writes it directly into a database table. Record field names become column names, and each record becomes a row. If the target table does not exist, `todb` will attempt to create it automatically, inferring column definitions from the data. If you prefer more control, you can explicitly declare fields and their SQL types.

By default, `todb` uses SQLite as the database backend (via Bun's built-in `bun:sqlite`), writing to a local file you specify with `--dbfile`. If no file is given, an in-memory database is used -- which is primarily useful for testing, since the data vanishes when the process exits. The Perl version supports MySQL, PostgreSQL, and Oracle as well, though the TypeScript port currently focuses on SQLite.

This command will create an auto-incrementing `id` primary key column in addition to your data columns. Field values default to `VARCHAR(255)` unless you specify a SQL type explicitly with the `field=TYPE` syntax. If you need to start fresh, `--drop` will obliterate the existing table before recreating it. The `--debug` flag prints every SQL statement as it executes, which is invaluable when things go sideways.

## Options

| Flag | Description |
|------|-------------|
| `--drop` | Drop the table before running create/insert commands. |
| `--table` | Name of the table to work with (default: `recs`). |
| `--debug` | Print all executed SQL statements. |
| `--key` / `-k` | Fields to insert. Can be `fieldName` or `fieldName=SQL_TYPE`. May be specified multiple times or comma-separated. If any fields are specified, only those fields will be inserted. |
| `--fields` / `-f` | Alias for `--key`. |
| `--dbfile` | Path to the SQLite database file. Defaults to in-memory if not specified. |
| `--type` | Database type (currently: `sqlite`). |
| `--filename-key` / `--fk` | Add a key with the source filename (puts `NONE` if not applicable). |

## Examples

### Insert all records into a SQLite database
```bash
cat data.jsonl | recs todb --dbfile mydata.db --table events
```
Creates (if needed) and populates the `events` table with all record fields.

### Specify fields and types
```bash
cat data.jsonl | recs todb --dbfile mydata.db --key status --key description=TEXT --key user
```
Only inserts the `status`, `description`, and `user` fields. The `description` column gets type `TEXT` instead of the default `VARCHAR(255)`, so those lengthy error messages survive intact.

### Drop and recreate the table
```bash
cat fresh-data.jsonl | recs todb --dbfile mydata.db --drop --table imports
```
Drops the `imports` table first, ensuring you start with a clean slate.

### Debug SQL execution
```bash
cat data.jsonl | recs todb --dbfile test.db --debug
```
Prints every `CREATE TABLE` and `INSERT` statement as it runs. Handy for verifying your schema looks right.

### Full pipeline: process logs into a queryable database
```bash
recs fromapache access.log | recs todb --dbfile logs.db --table access --key ip,method,path,status,size
```
Parse Apache logs and store them in SQLite for ad-hoc querying with your favorite SQL tool.

## See Also

- [fromdb](./fromdb) - The inverse: query a SQLite database into records
- [tocsv](./tocsv) - Output as CSV (for when you want a file, not a database)
