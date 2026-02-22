# fromps

Generate records from the process table.

## Synopsis

```bash
recs fromps [options]
```

## Description

Generate records from the process table. Prints out JSON records converted from the process table. Fields default to all available fields from ps.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<fields>` | Fields to output. May be specified multiple times, may be comma separated. Defaults to all fields. |
| `--field` / `-f` `<fields>` | Fields to output. May be specified multiple times, may be comma separated. Defaults to all fields. |

## Examples

### Get records for the process table
```bash
recs fromps
```

### Only get uid and pid
```bash
recs fromps --key uid,pid
```
