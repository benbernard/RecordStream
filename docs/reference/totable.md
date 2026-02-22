# totable

Output records as a formatted ASCII table.

## Synopsis

```bash
recs totable [options] [files...]
```

## Description

The `totable` command reads your entire record stream, calculates optimal column widths, and prints a neatly aligned ASCII table to the screen. It is the quick-and-dirty visualization workhorse of RecordStream -- when you want to see your data in tabular form without leaving the terminal, this is your command.

Because `totable` needs to know the widest value in each column before it can print anything, it buffers the entire record stream in memory. This is a worthwhile trade-off for the clean output, but keep it in mind if you are working with millions of records (at that point, consider `tocsv` or `toprettyprint` which can stream).

The `--spreadsheet` flag switches to a format designed for pasting into Excel or Google Sheets: tab-delimited by default (customizable with `--delim`), no header separator line. The `--clear` flag is a nice touch for hierarchical data: when a cell value is identical to the one above it, it is replaced with a blank, making it easy to visually parse grouped data without repetitive noise.

## Options

| Flag | Description |
|------|-------------|
| `--no-header` / `-n` | Do not print column headers. |
| `--key` / `-k` | Specify fields to include in the table. May be comma-separated or specified multiple times. Supports keyspecs and keygroups. Defaults to all fields. |
| `--field` / `-f` | Alias for `--key`. |
| `--spreadsheet` / `-s` | Print in spreadsheet-compatible format: single-character delimiter between fields (no padding), no separator line after headers. |
| `--delim` / `-d` | Delimiter for spreadsheet mode (default: tab). Only useful with `--spreadsheet`. |
| `--clear` | Replace cell values with blanks when they match the cell above, making grouped data easier to scan. |
| `--filename-key` / `--fk` | Add a key with the source filename (puts `NONE` if not applicable). |

## Examples

### Display all fields as a table
```bash
cat data.jsonl | recs totable
```
Reads all records, auto-detects columns, and prints with aligned spacing:

```
name      age   city
-----     ---   -----------
Alice     30    New York
Bob       25    San Francisco
Charlie   35    Chicago
```

### Select specific fields
```bash
cat data.jsonl | recs totable --key name,status
```
Shows only the `name` and `status` columns.

### Skip the header
```bash
cat data.jsonl | recs totable -f pid -f command --no-header
```
Prints just the data rows, no header or separator line.

### Spreadsheet-compatible output
```bash
cat data.jsonl | recs totable --spreadsheet | pbcopy
```
Tab-delimited output, ready to paste into your spreadsheet of choice. On macOS, `pbcopy` puts it right on the clipboard.

### Custom spreadsheet delimiter
```bash
cat data.jsonl | recs totable --spreadsheet --delim '|'
```
Uses pipe as the delimiter instead of tab. Because sometimes you need pipe-separated values and `tocsv` feels like overkill.

### Clear duplicate values for grouped data
```bash
cat data.jsonl | recs sort --key region,team | recs totable --key region,team,name --clear
```
When sorted by region and team, duplicate region and team values are replaced with blanks:

```
region      team        name
------      ----        -------
us-east     backend     Alice
                        Bob
            frontend    Charlie
us-west     backend     Diana
            frontend    Eve
```

Much easier to read than seeing "us-east" repeated five times.

### Process listing as a table
```bash
recs fromps | recs sort --key rss=numeric --reverse | recs totable --key pid,command,rss --n 10
```
Shows the top memory consumers in a clean table. (Note: use `recs topn` or pipe through `head` for the top-N filtering.)

## See Also

- [toprettyprint](./toprettyprint) - One-key-per-line format (better for records with many fields)
- [toptable](./toptable) - Pivot table output (for cross-tabulated summaries)
- [tocsv](./tocsv) - CSV output (for machine consumption or spreadsheet import)
- [tohtml](./tohtml) - HTML table output (for web reports)
