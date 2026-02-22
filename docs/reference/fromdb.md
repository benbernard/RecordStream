# fromdb

Execute a select statement on a database and create a record stream from the results.

## Synopsis

```bash
recs fromdb [options]
```

## Description

Execute a select statement on a database and create a record stream from the results. The keys of the record will be the column names and the values the row values.

## Options

| Flag | Description |
|------|-------------|
| `--table` `<table>` | Table name (shortcut for SELECT * FROM table). |
| `--sql` `<statement>` | SQL select statement to run. |
| `--dbfile` `<path>` | Path to the database file. |
| `--type` `<dbtype>` | Database type (default: sqlite). |

## Examples

### Dump a table
```bash
recs fromdb --type sqlite --dbfile testDb --table recs
```

### Run a select statement
```bash
recs fromdb --dbfile testDb --sql 'SELECT * FROM recs WHERE id > 9'
```
