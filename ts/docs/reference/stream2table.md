# stream2table

Convert a record stream into a 2D table structure by pivoting on a column field.

## Synopsis

```bash
recs stream2table [options] [files...]
```

## Description

The `stream2table` command reshapes a stream of records by pivoting them around a designated "column" field. Records are grouped by the values of this field, and then combined row-by-row into output records where each unique column value becomes a top-level key containing the corresponding record's data.

In simpler terms: if your data looks like a series of rows where a field identifies what "column" each row belongs to, `stream2table` rotates them into a table where each column's data sits side by side in a single record.

Note that this operation spools the entire stream into memory, since it needs to see all records before it can determine the shape of the output.

## Options

| Flag | Description |
|------|-------------|
| `--field` / `-f` | The field to use as the column key. May be a key spec. Required. |

## How It Works

Given this input:
```json
{"column": "foo", "data": "foo1"}
{"column": "foo", "data": "foo2"}
{"column": "boo", "data": "boo1"}
{"column": "boo", "data": "boo2"}
```

Running `recs stream2table --field column` produces:
```json
{"foo": {"data": "foo1"}, "boo": {"data": "boo1"}}
{"foo": {"data": "foo2"}, "boo": {"data": "boo2"}}
```

The records are matched row-by-row: the first "foo" pairs with the first "boo", the second "foo" with the second "boo", and so on. The column field itself is removed from the nested record if it is a simple (non-nested) field name.

## Examples

### Pivot a stat stream into a wide table
```bash
# Input: one record per stat per timestamp
# {"stat": "cpu", "value": 80, "time": 1}
# {"stat": "mem", "value": 60, "time": 1}
# {"stat": "cpu", "value": 85, "time": 2}
# {"stat": "mem", "value": 65, "time": 2}
recs stream2table --field stat
# Output:
# {"cpu": {"value": 80, "time": 1}, "mem": {"value": 60, "time": 1}}
# {"cpu": {"value": 85, "time": 2}, "mem": {"value": 65, "time": 2}}
```

### Pivot and flatten for downstream processing
```bash
recs stream2table --field stat | recs flatten --deep cpu,mem
# Output: {"cpu-value": 80, "cpu-time": 1, "mem-value": 60, "mem-time": 1}
```

### Convert metrics from long format to wide format
```bash
recs fromcsv metrics.csv \
  | recs stream2table --field metric_name \
  | recs flatten -1 cpu_usage,memory_usage,disk_io
```

## Notes

If columns have different numbers of records, shorter columns will be absent from later output records. The output has as many records as the longest column group.

## See Also

- [flatten](./flatten) - Flatten nested structures (often used after stream2table)
- [collate](./collate) - Group and aggregate records
- [decollate](./decollate) - Expand fields into separate records (inverse direction)
