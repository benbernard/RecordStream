# annotate

Evaluate an expression on each record and cache the resulting changes by key grouping.

## Synopsis

```bash
recs annotate [options] <expression> [files...]
```

## Description

Evaluate an expression on each record and cache the resulting changes by key grouping. When a record with the same key values is seen again, the cached annotation is applied instead of re-evaluating the expression. Only use this if you have --keys fields that are repeated; otherwise recs xform will be faster.

## Options

| Flag | Description |
|------|-------------|
| `--keys` / `-k` `<keys>` | Keys to match records by. May be specified multiple times. May be a keygroup or keyspec. **(required)** |

## Examples

### Annotate records with IPs with hostnames, only doing lookup once
```bash
recs annotate --key ip 'r.hostname = lookupHost(r.ip)'
```

### Record md5sums of files
```bash
recs annotate --key filename 'r.md5 = computeMd5(r.filename)'
```

## See Also

- [xform](./xform)
