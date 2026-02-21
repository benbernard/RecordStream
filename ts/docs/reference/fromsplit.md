# fromsplit

Split each line on a delimiter to produce records.

## Synopsis

```bash
recs fromsplit [options] [files...]
```

## Description

`fromsplit` is the simplest text-to-records converter. It splits each line of input on a delimiter and maps the resulting pieces to record fields. Think of it as `fromcsv`'s less fussy sibling -- no quoting rules, no escape characters, just split and go.

By default, the delimiter is a comma and the field names are numeric (0, 1, 2, ...). You can provide meaningful names with `--key` and change the delimiter with `--delim`. A key feature: the delimiter is treated as a regular expression by default, so `--delim '\s+'` splits on any whitespace, and `--delim '[,;]'` splits on either commas or semicolons. If you want the delimiter treated as a literal string, pass `--strict`.

For data with a header row, use `--header` to consume the first line as field names. This combines nicely with delimiter-separated data that is not quite CSV (no quoting, no escaping) but does have a header.

## Options

| Flag | Description |
|------|-------------|
| `--delim <delim>` / `-d <delim>` | Delimiter for splitting. Default is `,`. Treated as a regex unless `--strict` is set. |
| `--key <keys>` / `-k <keys>` | Comma-separated list of field names. May be specified multiple times. Supports key specs. |
| `--field <keys>` / `-f <keys>` | Alias for `--key`. |
| `--header` | Use the first line of input as field names. |
| `--strict` | Treat the delimiter as a literal string, not a regex. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename. |

## Examples

### Split comma-separated values with named keys
```bash
echo 'Alice,30,Engineer' | recs fromsplit --key name,age,title
```
Output: `{"name":"Alice","age":"30","title":"Engineer"}`

### Split on whitespace (regex delimiter)
```bash
echo 'Alice   30   Engineer' | recs fromsplit --key name,age,title --delim '\s+'
```

### Split space-separated data with named fields
```bash
recs fromsplit --key x,y --delim ' ' < coordinates.txt
```

### Parse a tab-delimited file with a header
```bash
recs fromsplit --header --delim $'\t' < data.tsv
```

### Split on pipe character (literal, using strict mode)
```bash
echo 'Alice|30|Engineer' | recs fromsplit --key name,age,title --delim '|' --strict
```

Without `--strict`, the `|` would be interpreted as regex alternation.

### Parse colon-separated /etc/passwd entries
```bash
recs fromsplit --key user,pass,uid,gid,gecos,home,shell --delim ':' < /etc/passwd \
  | recs grep '{{shell}} =~ /bash/'
```

### Split on multiple possible delimiters
```bash
recs fromsplit --delim '[,;\t]' --key a,b,c < messy_data.txt
```

## Notes

- Empty lines are skipped.
- Since the default delimiter is a regex, characters with special regex meaning (like `.`, `|`, `*`, `+`, `?`, `(`, `)`, `[`, `]`, `{`, `}`, `^`, `$`, `\`) need to be escaped or use `--strict` mode.
- The `--delim` value is compiled into a JavaScript `RegExp` (unless `--strict`), so full regex syntax is available.
- Unlike `fromcsv`, there is no concept of quoted fields. If your data contains the delimiter inside field values, use `fromcsv` or `fromre` instead.

## See Also

- [fromcsv](./fromcsv) - For properly quoted CSV/TSV data
- [fromre](./fromre) - For regex-based extraction with capture groups
- [fromkv](./fromkv) - For key=value pair data
