# fromcsv

Each line of input (or lines of &lt;files&gt;) is split on commas to produce an output record.

## Synopsis

```bash
recs fromcsv [options] [<files>]
```

## Description

Each line of input (or lines of &lt;files&gt;) is split on commas to produce an output record. Fields are named numerically (0, 1, etc.), or as given by --key, or as read by --header. Lines may be split on delimiters other than commas by providing --delim.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<keys>` | Comma separated list of field names. May be specified multiple times, may be key specs. |
| `--field` / `-f` `<keys>` | Comma separated list of field names. May be specified multiple times, may be key specs. |
| `--header` | Take field names from the first line of input. |
| `--strict` | Do not trim whitespace, allow loose quoting (quotes inside quotes), or allow the use of escape characters when not strictly needed. |
| `--delim` / `-d` `<character>` | Field delimiter to use when reading input lines (default ','). |
| `--escape` `<character>` | Escape character used in quoted fields (default '"'). |
| `--quote` `<character>` | Quote character used in quoted fields (default '"'). Use the empty string to indicate no quoted fields. |

## Examples

### Parse csv separated fields x and y
```bash
recs fromcsv --field x,y
```

### Parse data with a header line specifying fields
```bash
recs fromcsv --header
```

### Parse tsv data (using bash syntax for a literal tab)
```bash
recs fromcsv --delim $'\t'
```

## See Also

- [fromsplit](./fromsplit)
- [fromre](./fromre)
