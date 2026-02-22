# fromsplit

Each line of input (or lines of &lt;files&gt;) is split on the provided delimiter to produce an output record.

## Synopsis

```bash
recs fromsplit [options] [<files>]
```

## Description

Each line of input (or lines of &lt;files&gt;) is split on the provided delimiter to produce an output record. Keys are named numerically (0, 1, etc.) or as given by --key.

## Options

| Flag | Description |
|------|-------------|
| `--delim` / `-d` `<delim>` | Delimiter to use for splitting input lines (default ','). |
| `--key` / `-k` `<keys>` | Comma separated list of key names. May be specified multiple times, may be key specs. |
| `--field` / `-f` `<keys>` | Comma separated list of key names. May be specified multiple times, may be key specs. |
| `--header` | Take key names from the first line of input. |
| `--strict` | Delimiter is not treated as a regex. |

## Examples

### Parse space separated keys x and y
```bash
recs fromsplit --key x,y --delim ' '
```

### Parse comma separated keys a, b, and c
```bash
recs fromsplit --key a,b,c
```

## See Also

- [fromcsv](./fromcsv)
- [fromre](./fromre)
