# toprettyprint

Pretty-print records in a human-readable, one-key-per-line format.

## Synopsis

```bash
recs toprettyprint [options] [files...]
```

## Description

The `toprettyprint` command (often affectionately abbreviated as `tpp` by frequent users) displays each record with one key per line, separated by a row of dashes. This is the go-to command when you need to actually read your data rather than pipe it somewhere. It excels at making records with many fields or deeply nested structures comprehensible at a glance.

By default, nested hashes and arrays are expanded recursively with indentation, making it easy to trace the structure of complex records. If you prefer a flattened view (one line per top-level key, nested values shown as JSON), the `--nonested` flag collapses everything. The `--aligned` option lines up the `=` signs by padding key names to the same width, which is a small touch that makes a big difference when scanning long output.

For quick inspection, `--1` (or `--one`) prints only the first record and stops -- perfect for understanding the shape of your data without scrolling through thousands of records. The `--n` flag lets you peek at an arbitrary number. Combined with `grep`, `toprettyprint` becomes a powerful exploration tool: pipe through `--one` and grep for field names to find what you are looking for.

## Options

| Flag | Description |
|------|-------------|
| `--1` / `--one` | Only print the first record. |
| `--n` | Only print the first N records. |
| `--keys` / `-k` | Only print the specified keys. Supports keyspecs and keygroups. |
| `--nonested` | Do not recursively nest the output of hashes and arrays. Keep each value on one line. |
| `--aligned` | Format keys to the same width so values are aligned. Accepts `right` (default) or `left` to control key alignment within the padded width. |
| `--filename-key` / `--fk` | Add a key with the source filename (puts `NONE` if not applicable). |

## Examples

### Inspect all records
```bash
cat data.jsonl | recs toprettyprint
```
Displays every record with one key per line, separated by dashes.

### Peek at the first record
```bash
cat data.jsonl | recs toprettyprint --1
```
Shows just the first record. The fastest way to understand what your data looks like.

### Find fields containing "time"
```bash
cat data.jsonl | recs toprettyprint --one | grep time
```
A classic pattern: pretty-print one record and grep for fields of interest. Much faster than reading raw JSON with your eyeballs.

### Show only specific fields
```bash
cat data.jsonl | recs toprettyprint --keys status,error,timestamp
```
Filters the display to just the fields you care about.

### Aligned output for readability
```bash
cat data.jsonl | recs toprettyprint --aligned right --n 5
```
Right-aligns key names so all the `=` signs line up. Prints the first 5 records. The output looks like:

```
----------------------------------------------------------------------
   hostname = "web-01"
     region = "us-east-1"
     status = "healthy"
----------------------------------------------------------------------
   hostname = "web-02"
     region = "eu-west-1"
     status = "degraded"
```

### Flat output without nesting
```bash
cat complex-data.jsonl | recs toprettyprint --nonested --n 3
```
Keeps each value on a single line, showing nested objects as inline JSON. Useful when you want a compact overview.

### Inspect process data
```bash
recs fromps | recs toprettyprint --keys pid,command,rss,state --n 10
```
Shows the first 10 processes with selected fields, formatted for easy reading.

## See Also

- [totable](./totable) - Display records as an aligned ASCII table (better for comparing across records)
- [tojsonarray](./tojsonarray) - Output as a JSON array (for machine consumption)
- [tohtml](./tohtml) - Output as an HTML table (for web viewing)
