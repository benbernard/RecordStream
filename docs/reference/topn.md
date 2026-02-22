# topn

Output the top N records from the input stream or from files.

## Synopsis

```bash
recs topn [options] [files...]
```

## Description

Output the top N records from the input stream or from files. You may segment the input based on a list of keys such that unique values of keys are treated as distinct input streams. This enables top-N listings per value groupings. The key values need not be contiguous in the input.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<keyspec>` | Comma-separated list of fields to group by. May be specified multiple times. May be a keyspec or keygroup. |
| `--topn` / `-n` `<number>` | Number of records to output. Default is 10. |
| `--delimiter` `<string>` | String used internally to delimit values when performing a topn on a keyspec that includes multiple keys. |

## Examples

### Output just the top 5 records
```bash
recs topn -n 5
```

### Output 10 records for each area
```bash
recs sort --key area | recs topn -n 10 --key area
```

### Output the top 10 longest running queries per area and priority level
```bash
recs sort --key area,priority,runtime=-n | recs topn -n 10 --key area,priority
```

## See Also

- [sort](./sort)
- [grep](./grep)
