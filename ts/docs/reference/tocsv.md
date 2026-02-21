# tocsv

Output records as CSV (or other character-separated) format.

## Synopsis

```bash
recs tocsv [options] [files...]
```

## Description

The `tocsv` command takes a record stream and renders it as CSV-formatted output, suitable for importing into spreadsheets, databases, or any tool that speaks the lingua franca of tabular data. Headers are printed on the first line by default, derived from the keys of the first record.

By default, all fields from the first record are included as columns (sorted alphabetically). You can restrict which fields appear using `--key`, which also supports keyspecs for reaching into nested structures and keygroups for matching fields by pattern.

With the `--delim` option you can switch from commas to any single-character delimiter, making it trivial to produce TSV files or other exotic separations. Values containing the delimiter, double quotes, or newlines are automatically escaped per RFC 4180 -- because nobody wants to debug CSV quoting issues at 2am.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | Comma-separated keys to output. Defaults to all fields in the first record. May be a keyspec or keygroup. |
| `--noheader` / `--nh` | Do not output headers on the first line. |
| `--delim` / `-d` | Field delimiter character (default: `,`). Must be a single character. |
| `--filename-key` / `--fk` | Add a key with the source filename (puts `NONE` if not applicable). |

## Examples

### Basic CSV output
```bash
recs tocsv myrecords.jsonl
```
Prints all records in CSV format with a header row.

### Select specific fields
```bash
cat server-stats.jsonl | recs tocsv --key hostname,cpu,memory
```
Only includes the `hostname`, `cpu`, and `memory` columns.

### Access nested values
```bash
cat data.jsonl | recs tocsv --key time,stat/avg,stat/max
```
Reaches into the `stat` object to pull out `avg` and `max` as separate columns.

### Produce TSV output
```bash
cat data.jsonl | recs tocsv --delim $'\t'
```
Uses tab as the delimiter instead of comma. Your spreadsheet will thank you.

### Skip the header row
```bash
cat data.jsonl | recs tocsv --noheader >> existing-data.csv
```
Appends data to an existing CSV file without duplicating the header.

### Pipeline from another recs command
```bash
recs fromps | recs tocsv --key pid,command,rss > processes.csv
```
Captures running processes and exports selected fields to CSV.

## See Also

- [fromcsv](./fromcsv) - The inverse: parse CSV into records
- [totable](./totable) - Output as a human-readable ASCII table
- [tohtml](./tohtml) - Output as an HTML table
