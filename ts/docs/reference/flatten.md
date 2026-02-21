# flatten

Flatten nested structures in records into top-level fields.

## Synopsis

```bash
recs flatten [options] [files...]
```

## Description

The `flatten` command takes nested objects and arrays within records and promotes their contents to top-level fields, using a separator character (default: `-`) to construct the new field names. A record like `{"a": {"b": 1}}` becomes `{"a-b": 1}`.

This is useful when downstream tools or aggregations need flat records, or when you want to work with nested data using tools that only understand top-level keys. That said, RecordStream's key spec system (`foo/bar`, `arr/#0`) handles nested access natively, so you may not need `flatten` as often as you think. Consider key specs first.

You can control the flattening depth: depth 1 (the default) flattens one level, depth 2 flattens two levels, and negative depth (`--deep`) flattens everything recursively until only scalar values remain.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | Comma-separated list of fields to flatten at the default depth. |
| `--depth` | Change the default depth. Negative values mean arbitrary (unlimited) depth. Default is 1. |
| `--deep` | Comma-separated list of fields to flatten to arbitrary (unlimited) depth. |
| `--separator` | String used to join field name components. Default is `-`. |
| `--1` through `--9` | Flatten the specified fields to exactly that depth. E.g., `--2 data` flattens the `data` field to depth 2. |

## Examples

### Flatten a nested object one level
```bash
# Input:  {"field": {"subfield": "value"}}
# Output: {"field-subfield": "value"}
recs flatten --key field
```

### Flatten arrays into indexed fields
```bash
# Input:  {"tags": ["a", "b", "c"]}
# Output: {"tags-0": "a", "tags-1": "b", "tags-2": "c"}
recs flatten --key tags
```

### Deep flatten for arbitrarily nested structures
```bash
# Input:  {"x": {"y": [{"z": "v"}]}}
# Output: {"x-y-0-z": "v"}
recs flatten --deep x
```

### Use a custom separator
```bash
# Input:  {"config": {"db": {"host": "localhost"}}}
# Output: {"config.db.host": "localhost"}
recs flatten --deep config --separator .
```

### Flatten to a specific depth
```bash
# Flatten 'data' to exactly 2 levels
recs flatten --2 data
```

### Flatten before collation
```bash
recs flatten --deep metrics \
  | recs collate -a max_cpu=max,metrics-cpu -a avg_mem=avg,metrics-memory
```

## Notes

Under depth-1 flattening:
- `{"field": "value"}` stays as `{"field": "value"}` (scalars are untouched)
- `{"field": {"sub": "val"}}` becomes `{"field-sub": "val"}`
- `{"field": ["a", "b"]}` becomes `{"field-0": "a", "field-1": "b"}`
- `{"field": {"sub": [0, 1]}}` becomes `{"field-sub": [0, 1]}` (stops at depth 1)

## See Also

- [decollate](./decollate) - Expand aggregated fields (different kind of denormalization)
- [xform](./xform) - Arbitrary transformations including manual restructuring
- [stream2table](./stream2table) - Convert stream to 2D table (another restructuring tool)
