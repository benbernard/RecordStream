# tohtml

Prints out an HTML table for the records from input or from files.

## Synopsis

```bash
recs tohtml [options] [files...]
```

## Description

Prints out an HTML table for the records from input or from files.

## Options

| Flag | Description |
|------|-------------|
| `--keys` / `-k` / `--key` / `--fields` / `-f` `<keys>` | Keys to print in the table. May be specified multiple times or comma separated. Defaults to all fields in the first record. |
| `--noheader` | Do not print the header row. |
| `--rowattributes` / `--row` `<attributes>` | HTML attributes to put on the tr tags. |
| `--cellattributes` / `--cell` `<attributes>` | HTML attributes to put on the td and th tags. |

## Examples

### Print all fields as an HTML table
```bash
recs tohtml
```

### Print foo and bar fields, without a header
```bash
recs tohtml --fields foo,bar --noheader
```

## See Also

- [totable](./totable)
- [toprettyprint](./toprettyprint)
