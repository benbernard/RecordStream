# normalizetime

Given a single key field containing a date/time value, construct a normalized version of the value and place it into a field named 'n_&lt;key&gt;'.

## Synopsis

```bash
recs normalizetime [options] [files...]
```

## Description

Given a single key field containing a date/time value, construct a normalized version of the value and place it into a field named 'n_&lt;key&gt;'. Used in conjunction with recs collate to aggregate information over normalized time buckets.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<key>` | Key field containing the date/time value. May be a key spec. **(required)** |
| `--threshold` / `-n` `<time range>` | Number of seconds in each bucket. May also be a duration string like '1 week' or '5 minutes'. **(required)** |
| `--epoch` / `-e` | Assumes the date/time field is expressed in epoch seconds (optional, defaults to non-epoch). |
| `--strict` / `-s` | Apply strict normalization (defaults to non-strict). |

## Examples

### Tag records with normalized time in 5 minute buckets from the date field
```bash
recs normalizetime --strict --key date -n 300
```

### Normalize time with fuzzy normalization into 1 minute buckets from an epoch-relative time field
```bash
recs normalizetime --key time -e -n 60
```

### Get 1 week buckets
```bash
recs normalizetime --key timestamp -n '1 week'
```

## See Also

- [collate](./collate)
