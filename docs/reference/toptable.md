# toptable

Create a multi-dimensional pivot table from a record stream.

## Synopsis

```bash
recs toptable [options] [files...]
```

## Description

The `toptable` command creates a pivot table -- the kind of cross-tabulated, multi-dimensional summary that makes analysts grin and data engineers nod approvingly. You specify which fields form the column headers (`--x-field`), which form the row headers (`--y-field`), and the remaining fields become the cell values. The values of the specified fields become the actual row and column labels, not the field names themselves.

The real power comes from the special `FIELD` value. When you have multiple leftover value fields (say, `count` and `sum_rss`), placing `FIELD` on an axis expands it so that each value field gets its own column or row. This lets you see multiple metrics side by side in a single table without running separate queries.

The `--pin` option filters records to specific field values (functionally equivalent to a `grep` before the toptable, but more convenient). The `--sort` option controls the ordering of header values with full sort specification support, including the `*` option to push `ALL` aggregation rows to the end. The `--records` flag switches output from a formatted table to JSON records, one per row, for further pipeline processing.

`toptable` pairs beautifully with `collate` and its `--cube` option. Collate summarizes your data with counts and aggregations; `--cube` adds the `ALL` totals; and `toptable` presents everything in a clear, cross-referenced grid. This three-command combo is the RecordStream answer to SQL's `GROUP BY ... WITH ROLLUP` plus a pivot.

## Options

| Flag | Description |
|------|-------------|
| `--x-field` / `-x` | Add an x field (column axis). Values of this field become column headers. May be specified multiple times or comma-separated. Supports keyspecs and keygroups. |
| `--y-field` / `-y` | Add a y field (row axis). Values of this field become row headers. May be specified multiple times or comma-separated. Supports keyspecs and keygroups. |
| `--v-field` / `-v` | Specify the value field to display in cells. If multiple value fields exist and `FIELD` is not on an axis, the last `--v` wins. If `FIELD` is on an axis, `--v` specifies which fields to include in that expansion. |
| `--pin` / `-p` | Pin a field to a specific value, only displaying matching records. Format: `field=value`. May be specified multiple times or comma-separated. |
| `--sort` | Sort specifications for x and y axis values. Uses recs sort specification syntax, including the `*` option to sort `ALL` to the end (e.g., `field=lex*`). |
| `--noheaders` | Do not print row and column headers. Removes blank header rows and columns. |
| `--records` / `--recs` | Output records (one per row) instead of a formatted table. Useful for further pipeline processing. |
| `--sort-all-to-end` / `--sa` | Sort `ALL` fields to the end for every x and y field. Equivalent to `--sort FIELD=*` for each axis field. |
| `--filename-key` / `--fk` | Add a key with the source filename (puts `NONE` if not applicable). |

## Examples

### Basic pivot table
```bash
cat data.jsonl | recs collate --perfect --key state,priority -a count | \
  recs toptable --x state --y priority
```
Cross-tabulates count by state (columns) and priority (rows):

```
+--------+-----+---+-----+
|        |state|run|sleep|
+--------+-----+---+-----+
|priority|     |   |     |
+--------+-----+---+-----+
|0       |     |1  |4    |
+--------+-----+---+-----+
|19      |     |2  |1    |
+--------+-----+---+-----+
```

### With cube totals
```bash
cat data.jsonl | recs collate --perfect --key state,priority -a count --cube | \
  recs toptable --x priority --y state
```
The `--cube` flag on collate adds `ALL` rows and columns, giving you row totals, column totals, and a grand total.

### Multiple value fields with FIELD expansion
```bash
cat data.jsonl | recs collate --perfect --key priority,state -a count -a sum,rss | \
  recs toptable --x priority,FIELD --y state
```
When you have both `count` and `sum_rss` as value fields, placing `FIELD` on the x axis creates a sub-column for each. You see both metrics at every intersection:

```
+-----+--------+-----+-------+-----+-------+
|     |priority|0    |       |19   |       |
+-----+--------+-----+-------+-----+-------+
|     |FIELD   |count|sum_rss|count|sum_rss|
+-----+--------+-----+-------+-----+-------+
|state|        |     |       |     |       |
+-----+--------+-----+-------+-----+-------+
|run  |        |1    |4784128|2    |8757248|
+-----+--------+-----+-------+-----+-------+
|sleep|        |4    |471040 |1    |0      |
+-----+--------+-----+-------+-----+-------+
```

### Select which value field to display
```bash
cat data.jsonl | recs collate --perfect --key priority,state -a count -a sum,rss | \
  recs toptable --x priority --y state --v count
```
When multiple value fields exist but `FIELD` is not on an axis, use `--v` to choose which one appears in the cells.

### Pin to a specific value
```bash
cat data.jsonl | recs collate --perfect --cube --key priority,state -a count -a sum,rss | \
  recs toptable --x priority,FIELD --y state -v sum_rss,count --pin state=run
```
Only shows rows where `state` is `run`. Equivalent to piping through `recs grep` first, but more concise.

### Sort ALL to the end
```bash
cat data.jsonl | recs collate --key region,product -a count --cube | \
  recs toptable --x region --y product --sort-all-to-end
```
Ensures the `ALL` summary rows and columns appear at the bottom and right of the table, rather than sorted alphabetically.

### Output as records for further processing
```bash
cat data.jsonl | recs collate --key state,priority -a count | \
  recs toptable --x state --y priority --records | \
  recs tocsv
```
Instead of printing a formatted table, outputs one JSON record per row, which you can then pipe through additional recs commands.

## See Also

- [collate](./collate) - Aggregate records by key (the natural precursor to toptable)
- [totable](./totable) - Display records as a simple ASCII table (no pivoting)
- [tohtml](./tohtml) - Output as an HTML table
