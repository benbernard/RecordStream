# multiplex

Take records, grouped together by --keys, and run a separate operation instance for each group.

## Synopsis

```bash
recs multiplex [options] -- <other recs operation>
```

## Description

Take records, grouped together by --keys, and run a separate operation instance for each group. Each group gets its own operation instance.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<keys>` | Comma-separated list of key fields for grouping. May be a key spec or key group. |
| `--line-key` / `-L` `<key>` | Use the value of this key as line input for the nested operation (rather than the entire record). Use with recs-from* operations generally. |
| `--adjacent` | Only group together adjacent records. Avoids spooling records into memory. |
| `--size` `<number>` | Number of running clumps to keep. |
| `--cube` | Enable cube mode. |

## Examples

### Tag lines with counts by thread
```bash
recs multiplex -k thread -- recs-eval 'r.nbr = ++nbr'
```

### Separate out a stream of text by PID into separate invocations of an operation
```bash
recs fromre '^(.*PID=([0-9]*).*)$' -f line,pid | recs multiplex -L line -k pid -- recs-frommultire ...
```

## See Also

- [collate](./collate)
- [chain](./chain)
