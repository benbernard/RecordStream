# topn

Output the top N records from the input stream, optionally grouped by key.

## Synopsis

```bash
recs topn [options] [files...]
```

## Description

The `topn` command is a simple but frequently needed operation: keep only the first N records. When used with `--key`, it keeps the first N records for each unique combination of key values, making it a "top N per group" operation.

This is the tool you reach for after sorting. Sort your data by the field you care about in descending order, then pipe it through `topn` to get the top performers. Or use it with grouped keys to get "the 5 highest-scoring players per team" or "the 10 most recent events per host."

The key values do not need to be contiguous in the input stream -- `topn` tracks counts per unique key combination. However, for the output to represent a meaningful "top N," you typically want the input pre-sorted by whatever metric defines "top."

## Options

| Flag | Description |
|------|-------------|
| `--topn` / `-n` | Number of records to output per group. Default is 10. |
| `--key` / `-k` | Comma-separated list of fields to group by. May be specified multiple times. May be a key spec or key group. Without `--key`, the entire stream is treated as one group. |
| `--delimiter` | Internal delimiter for composite keys. Default is `9t%7Oz%]`. You should only need to change this if your data values contain this exact string, which seems unlikely but is technically possible. |

## Examples

### Keep just the first 5 records
```bash
recs topn -n 5
```

### Top 10 records per area (pre-sorted)
```bash
recs sort --key area | recs topn -n 10 --key area
```

### Top 10 longest-running queries per area and priority
```bash
recs sort --key area,priority,runtime=-n \
  | recs topn -n 10 --key area,priority
```

### Top 3 highest-scoring players per team
```bash
recs sort --key team,score=-numeric \
  | recs topn -n 3 --key team
```

### Get the single most recent event per host
```bash
recs sort --key host,timestamp=-numeric \
  | recs topn -n 1 --key host
```

### Pipeline: find top error-producing endpoints
```bash
recs fromcsv requests.csv \
  | recs grep 'r.status >= 500' \
  | recs collate -k endpoint -a error_count=count \
  | recs sort -k error_count=-numeric \
  | recs topn -n 10
```

## Notes

Without `--key`, `recs topn -n 5` is functionally equivalent to `recs grep 'line <= 5'`, but `topn` is more readable and clearly communicates intent.

The records are output in the order they are received. `topn` does not sort -- it simply counts and stops emitting records for a group once the limit is reached.

## See Also

- [sort](./sort) - Sort records (usually the step before topn)
- [grep](./grep) - Filter records by predicate
- [collate](./collate) - Group and aggregate records
- [substream](./substream) - Filter to a range of records
