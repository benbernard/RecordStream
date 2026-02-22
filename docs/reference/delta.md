# delta

Transforms absolute values into deltas between adjacent records.

## Synopsis

```bash
recs delta [options] [files...]
```

## Description

Transforms absolute values into deltas between adjacent records. Fields specified by --key are replaced with the difference between the current and previous record values. Fields not in this list are passed through unchanged, using the first record of each delta pair.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<keys>` | Comma-separated list of the fields that should be transformed. May be a keyspec or a keygroup. **(required)** |

## Examples

### Transform a cumulative counter of errors into a count of errors per record
```bash
recs delta --key errors
```

## See Also

- [xform](./xform)
- [collate](./collate)
