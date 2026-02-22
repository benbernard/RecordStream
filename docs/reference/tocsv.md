# tocsv

Outputs records as CSV formatted lines.

## Synopsis

```bash
recs tocsv [options] [files...]
```

## Description

Outputs records as CSV formatted lines. With the --delim option, it can output TSV or other line-based formats with character-separated fields.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<keyspec>` | Comma separated keys to output. Defaults to all fields in the first record. May be a keyspec or a keygroup. |
| `--noheader` / `--nh` | Do not output headers on the first line. |
| `--delim` / `-d` `<character>` | Field delimiter character to use when outputting lines (default ','). |

## Examples

### Print records to csv format with headers
```bash
recs tocsv myrecords
```

### Only print time and a nested value of stat/avg
```bash
... | recs tocsv --key time,stat/avg
```

## See Also

- [fromcsv](./fromcsv)
