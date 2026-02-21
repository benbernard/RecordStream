# fromcsv

Parse CSV and TSV text into records.

## Synopsis

```bash
recs fromcsv [options] [files...]
```

## Description

`fromcsv` is one of the most commonly used input operations. It reads CSV (comma-separated value) data from files or standard input and emits one record per row. Fields are named numerically by default (0, 1, 2, ...), but you can supply explicit names with `--key` or let the command read them from a header line with `--header`.

The parser handles quoted fields, embedded delimiters, and escaped quotes correctly. By default it operates in a lenient mode that trims whitespace from field values and tolerates minor quoting irregularities. If you need strict RFC 4180 compliance -- for example, when dealing with fields that contain literal newlines inside quotes -- pass `--strict`.

While the default delimiter is a comma, you can parse tab-separated (TSV), pipe-separated, or any other single-character-delimited data by passing `--delim`. The quote and escape characters are also configurable for those rare datasets that use something other than double quotes.

## Options

| Flag | Description |
|------|-------------|
| `--key <keys>` / `-k <keys>` | Comma-separated list of field names for the columns. May be specified multiple times. Supports key specs. |
| `--field <keys>` / `-f <keys>` | Alias for `--key`. |
| `--header` | Use the first line of input as field names instead of numeric indices. |
| `--delim <char>` / `-d <char>` | Field delimiter character. Default is `,`. Must be a single character. |
| `--strict` | Disable whitespace trimming, loose quoting, and unnecessary escape characters. Use this for strict RFC 4180 parsing. |
| `--escape <char>` | Escape character used inside quoted fields. Default is `"`. |
| `--quote <char>` | Quote character for quoted fields. Default is `"`. Pass an empty string to disable quoting entirely. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename (or `NONE` if reading from stdin). |

## Examples

### Parse a CSV with a header row
```bash
recs fromcsv --header < data.csv
```

### Parse named columns without a header
```bash
recs fromcsv --key name,age,city < people.csv
```

### Parse tab-separated data
```bash
recs fromcsv --header --delim $'\t' < data.tsv
```

### Parse pipe-separated data with named fields
```bash
recs fromcsv -d '|' -k host,status,latency < metrics.log
```

### Extract specific columns from a CSV and compute stats
```bash
recs fromcsv --header < sales.csv \
  | recs collate --aggregator 'sum(revenue)' --key region
```

### Parse a CSV with non-standard quoting
```bash
recs fromcsv --quote "'" --escape "\\" < quirky.csv
```

### Track which file each record came from
```bash
recs fromcsv --header --filename-key source *.csv
```

## Notes

- If both `--key` and `--header` are specified, the header line is consumed but the `--key` names take precedence for columns where both are defined.
- If a row has more columns than named keys, the extra columns receive numeric names starting after the last named key.
- The `--delim` value must be exactly one character; multi-character delimiters are not supported. For regex-based splitting, see `fromsplit`.

## See Also

- [fromsplit](./fromsplit) - Split lines on a delimiter (supports regex delimiters)
- [fromre](./fromre) - Extract fields using a regex pattern
- [tocsv](./tocsv) - Output records as CSV
