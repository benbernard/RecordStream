# todb

Dumps a stream of input records into a database.

## Synopsis

```bash
recs todb [options] [files...]
```

## Description

Dumps a stream of input records into a database. The record fields you want inserted should have the same keys as the column names in the database, and the records should be key-value pairs. This command will attempt to create the table if it is not already present.

## Options

| Flag | Description |
|------|-------------|
| `--drop` | Drop the table before running create/insert commands. |
| `--table` `<name>` | Name of the table to work with (default: 'recs'). |
| `--debug` | Print all the executed SQL. |
| `--key` / `-k` `<fields>` | Fields to insert. Can be a name or a name=SQL_TYPE pair. If any fields are specified, they will be the only fields put into the db. May be specified multiple times or comma separated. Type defaults to VARCHAR(255). |
| `--fields` / `-f` `<fields>` | Fields to insert. Can be a name or a name=SQL_TYPE pair. Alias for --key. |
| `--dbfile` `<path>` | Database file path (for SQLite). |
| `--type` `<type>` | Database type (sqlite). |

## Examples

### Put all records into the recs table
```bash
recs todb --type sqlite --dbfile testDb --table recs
```

### Specify fields and drop existing table
```bash
recs todb --dbfile testDb --drop --key status,description=TEXT --key user
```

## See Also

- [fromdb](./fromdb)
