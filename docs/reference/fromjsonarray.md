# fromjsonarray

Import JSON objects from within a JSON array.

## Synopsis

```bash
recs fromjsonarray [options] [<files>]
```

## Description

Import JSON objects from within a JSON array. Each object in the array becomes an output record.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<keys>` | Optional comma separated list of field names to extract. If none specified, use all keys. May be specified multiple times, may be key specs. |

## Examples

### Parse a JSON array file into records
```bash
recs fromjsonarray data.json
```

### Extract only specific keys from a JSON array
```bash
recs fromjsonarray --key name,age data.json
```
