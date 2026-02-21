# normalizetime

Normalize time fields into bucketed time ranges.

## Synopsis

```bash
recs normalizetime [options] [files...]
```

## Description

The `normalizetime` command takes a date/time field and normalizes it into fixed-size time buckets, adding the normalized value as a new field called `n_<key>`. This is the pre-processing step that makes time-series aggregation possible: rather than having thousands of unique timestamps, you reduce them to a manageable set of time bucket labels.

The bucket size is controlled by `--threshold`, which specifies the number of seconds in each bucket. You can express this as a raw number of seconds or as a human-readable duration string like `5 minutes` or `1 week`.

There are two normalization modes. **Strict** mode divides time into fixed segments aligned to the Unix epoch (January 1, 1970 00:00:00 UTC) -- every 60-second bucket starts at :00, :01:00, :02:00, etc., regardless of your data. **Non-strict** mode (the default) is more forgiving: it allows adjacent time periods to merge if the current record's time falls close to the previous record's bucket, producing smoother groupings for bursty data.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | The key field containing the date/time value. May be a key spec. Required. |
| `--threshold` / `-n` | Size of each time bucket. May be a number of seconds or a duration string (e.g., `5 minutes`, `1 hour`, `1 week`). Required. |
| `--strict` / `-s` | Use strict normalization: fixed buckets aligned to epoch. Default is non-strict. |
| `--epoch` / `-e` | The date/time field is expressed in epoch seconds (Unix timestamp). Faster than parsing date strings. |

### Supported Duration Strings

| Unit | Aliases |
|------|---------|
| Seconds | `s`, `sec`, `second`, `seconds` |
| Minutes | `m`, `min`, `minute`, `minutes` |
| Hours | `h`, `hr`, `hour`, `hours` |
| Days | `d`, `day`, `days` |
| Weeks | `w`, `week`, `weeks` |

## Strict vs. Non-Strict Normalization

### Strict Mode

Time is divided into fixed segments of `--threshold` seconds, aligned to epoch. With a 60-second threshold:

| date | n_date |
|------|--------|
| 1:00:00 | 1:00:00 |
| 1:00:14 | 1:00:00 |
| 1:00:59 | 1:00:00 |
| 1:02:05 | 1:02:00 |
| 1:02:55 | 1:02:00 |
| 1:03:15 | 1:03:00 |

### Non-Strict Mode (default)

The bucket assignment depends on the previous record's bucket. If the current time falls in the period adjacent to the previous bucket, it merges with the previous bucket. With a 60-second threshold:

| date | n_date | Note |
|------|--------|------|
| 1:00:00 | 1:00:00 | |
| 1:00:59 | 1:00:00 | |
| 1:02:05 | 1:02:00 | |
| 1:02:55 | 1:02:00 | |
| 1:03:15 | 1:02:00 | Merges with prior bucket |
| 1:05:59 | 1:05:00 | |
| 1:06:15 | 1:05:00 | Adjacent to prior |
| 1:07:01 | 1:07:00 | New bucket (gap too large) |

## Examples

### Strict 5-minute buckets from a date field
```bash
recs normalizetime --strict --key date -n 300
```

### Non-strict 1-minute buckets from epoch timestamps
```bash
recs normalizetime --key time -e -n 60
```

### Weekly buckets
```bash
recs normalizetime --key timestamp -n '1 week'
```

### Normalize then aggregate: count events per time bucket
```bash
recs normalizetime --key timestamp -n 300 --strict \
  | recs collate --key n_timestamp -a count
```

### Deduplicate bursty log entries
```bash
recs normalizetime -k date -n 300 \
  | recs collate -k n_date -a firstrec
```

### Full pipeline: count OOM errors per host per time bucket
```bash
recs frommultire --re 'host=@([^:]*):' --re 'date=^[A-Za-z]* (.*) GMT ' \
  | recs normalizetime --key date --threshold 300 \
  | recs collate --key n_date -a firstrec \
  | recs collate --key firstrec_host -a count
```

## See Also

- [collate](./collate) - Group and aggregate by the normalized time field
- [sort](./sort) - Sort by time before normalization
- [xform](./xform) - Custom time transformations
