# totable

Pretty prints a table of records to the screen.

## Synopsis

```bash
recs totable [options] [files...]
```

## Description

Pretty prints a table of records to the screen. Will read in the entire record stream to determine column size and number of columns.

## Options

| Flag | Description |
|------|-------------|
| `--no-header` / `-n` | Do not print column headers. |
| `--key` / `-k` / `--field` / `-f` `<field name>` | Specifies fields to put in the table. May be comma separated or specified multiple times. May be a keyspec or a keygroup. |
| `--spreadsheet` / `-s` | Print in spreadsheet-compatible format. Does not print line of dashes after header. Separates by single character rather than series of spaces. |
| `--delim` / `-d` `<string>` | Only useful with --spreadsheet. Delimit with the given string rather than the default of a tab. |
| `--clear` | Put blanks in cells where all of the row so far matches the row above. |

## Examples

### Display a table
```bash
recs totable
```

### Display only one field
```bash
recs totable -f foo
```

### Display two fields without a header
```bash
recs totable -f foo -f bar --no-header
```

## See Also

- [toprettyprint](./toprettyprint)
- [tohtml](./tohtml)
