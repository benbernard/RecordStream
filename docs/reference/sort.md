# sort

Sort records from input or from files.

## Synopsis

```bash
recs sort [options] [files...]
```

## Description

Sort records from input or from files. You may sort on a list of keys, each key sorted lexically (alpha order) or numerically. The sort type may be prefixed with '-' to indicate decreasing order.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<keyspec>` | Sort key specification. May be comma-separated, may be specified multiple times. Each keyspec is a name or name=sortType. Sort type may be lexical, numeric, nat, lex, n, or l. May be prefixed with '-' for decreasing order. |
| `--reverse` / `-r` | Reverse the sort order. |

## Examples

### Sort on the id field numerically
```bash
recs sort --key id=numeric
```

### Sort on age numerically, then name lexically
```bash
recs sort --key age=numeric,name
```

### Sort on decreasing size, then name
```bash
recs sort --key size=-numeric --key name
```

## See Also

- [collate](./collate)
- [topn](./topn)
