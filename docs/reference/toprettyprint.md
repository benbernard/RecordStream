# toprettyprint

Pretty print records, one key to a line, with a line of dashes separating records.

## Synopsis

```bash
recs toprettyprint [options] [files...]
```

## Description

Pretty print records, one key to a line, with a line of dashes separating records. Especially useful for records with very large amounts of keys.

## Options

| Flag | Description |
|------|-------------|
| `--1` / `--one` | Only print the first record. |
| `--n` `<n>` | Only print n records. |
| `--keys` / `-k` `<keys>` | Only print out specified keys. May be keyspecs or keygroups. |
| `--nonested` | Do not nest the output of hashes, keep each value on one line. |
| `--aligned` `[r|l|right|left]` | Format keys to the same width so values are aligned. Keys are right aligned by default, but you may pass a value of 'left' to left align keys within the width. |

## Examples

### Pretty print records
```bash
recs toprettyprint
```

### Find all keys with 'time' in the name or value
```bash
... | recs toprettyprint --one | grep time
```

## See Also

- [totable](./totable)
- [tohtml](./tohtml)
