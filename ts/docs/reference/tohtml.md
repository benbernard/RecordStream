# tohtml

Output records as an HTML table.

## Synopsis

```bash
recs tohtml [options] [files...]
```

## Description

The `tohtml` command renders your record stream as an HTML `<table>`, ready to drop into a web page, email, or report. Each record becomes a `<tr>` row, and each field becomes a `<td>` cell. A header row of `<th>` elements is included by default, derived from the field names.

By default, all fields from the first record are used as columns (sorted alphabetically). Use `--keys` to select specific fields or leverage keygroups to match fields by pattern. This keeps your tables focused on what matters rather than dumping every field into a 47-column monstrosity.

For styling, the `--rowattributes` and `--cellattributes` flags inject arbitrary HTML attributes into the `<tr>` and `<td>`/`<th>` tags respectively. This lets you apply CSS classes, inline styles, or data attributes without post-processing the output. The generated HTML uses minimal formatting, so it plays nicely with whatever CSS framework you prefer.

## Options

| Flag | Description |
|------|-------------|
| `--keys` / `-k` | Keys to include as columns. May be comma-separated or specified multiple times. Defaults to all fields in the first record. Supports keyspecs and keygroups. |
| `--fields` / `-f` | Alias for `--keys`. |
| `--noheader` | Do not print the header row. |
| `--rowattributes` | HTML attributes to add to each `<tr>` tag (e.g., `class="data-row"`). |
| `--cellattributes` | HTML attributes to add to each `<td>` and `<th>` tag. |
| `--filename-key` / `--fk` | Add a key with the source filename (puts `NONE` if not applicable). |

## Examples

### Basic HTML table
```bash
cat data.jsonl | recs tohtml > report.html
```
Produces a complete `<table>` element with headers and data rows.

### Select specific columns
```bash
cat users.jsonl | recs tohtml --keys name,email,role
```
Only includes the three specified fields in the table.

### Headerless table
```bash
cat data.jsonl | recs tohtml --fields foo,bar --noheader
```
Skips the `<th>` header row. Useful when embedding into a page that already has its own header.

### Styled table rows
```bash
cat data.jsonl | recs tohtml --rowattributes 'class="striped"' --cellattributes 'style="padding: 4px"'
```
Adds CSS classes and inline styles to the generated HTML elements.

### Full pipeline to a styled report
```bash
echo '<html><body>' > report.html
recs fromcsv sales.csv | recs grep '{{status}} eq "closed"' | \
  recs tohtml --keys customer,amount,date \
  --rowattributes 'class="sale-row"' >> report.html
echo '</body></html>' >> report.html
```
Filters closed sales and generates an HTML report. Add a `<style>` block and you have something worth showing to the boss.

## See Also

- [totable](./totable) - Output as an ASCII table (for terminal viewing)
- [tocsv](./tocsv) - Output as CSV (for spreadsheet import)
- [toptable](./toptable) - Output as a pivot table
