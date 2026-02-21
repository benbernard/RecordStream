# delta

Compute differences between consecutive records for specified fields.

## Synopsis

```bash
recs delta [options] [files...]
```

## Description

The `delta` command transforms absolute values into deltas between adjacent records. For each specified key field, the output value is the current record's value minus the previous record's value. Fields not listed in `--key` are passed through unchanged, using the values from the first record of each pair.

This is indispensable when working with cumulative counters -- the kind of monotonically increasing values you see in system monitoring, network statistics, or financial running totals. If your data says "total errors: 5, 12, 15, 22", delta tells you "errors this period: 7, 3, 7" which is usually what you actually want to know.

The first record is consumed but not emitted, since there is no prior record to compute a delta against. If either value in a pair is not a valid number, the delta field is set to null.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | Comma-separated list of fields to compute deltas on. May be a key spec or key group. May be specified multiple times. Required. |

## Examples

### Convert cumulative error counts into per-record error rates
```bash
recs delta --key errors
```

### Compute deltas on multiple fields at once
```bash
recs delta --key bytes_in,bytes_out,packets
```

### Delta on nested fields using key specs
```bash
recs delta --key stats/requests,stats/errors
```

### Pipeline: compute request rate from cumulative counters
```bash
recs fromcsv metrics.csv \
  | recs sort -k timestamp=numeric \
  | recs delta -k total_requests \
  | recs xform 'r.request_rate = r.total_requests / r.interval_seconds'
```

## See Also

- [xform](./xform) - General-purpose transformation (for more complex difference calculations)
- [collate](./collate) - Aggregate records (use with `--adjacent` for windowed computations)
- [sort](./sort) - Sort records (delta assumes records are in the correct order)
