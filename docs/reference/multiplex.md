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
| `--dlkey` / `-K` `<name>=<expression>` | Domain language key: name=expression where the expression evaluates as a valuation. |
| `--line-key` / `-L` `<key>` | Use the value of this key as line input for the nested operation (rather than the entire record). Use with recs-from* operations generally. |
| `--adjacent` / `-1` | Only group together adjacent records. Avoids spooling records into memory. |
| `--size` / `--sz` / `-n` `<number>` | Number of running clumps to keep. |
| `--cube` | Enable cube mode. |
| `--clumper` / `-c` `<spec>` | Clumper specification (e.g. keylru,field,size or keyperfect,field). |
| `--dlclumper` `<expression>` | Domain language clumper specification. |
| `--list-clumpers` | List available clumpers and exit. |
| `--show-clumper` `<name>` | Show details of a specific clumper and exit. |

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
