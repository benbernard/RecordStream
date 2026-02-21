# multiplex

Send groups of records to separate instances of a sub-operation.

## Synopsis

```bash
recs multiplex [options] -- <recs operation>
```

## Description

The `multiplex` command groups records by key (using the same clumper infrastructure as `collate`) and runs a separate instance of a recs operation for each group. Each group gets its own independent operation, complete with its own state. When a group finishes, the operation's output records are emitted.

Think of it as `collate`'s more flexible cousin. Where `collate` can only apply aggregators to groups, `multiplex` can run any recs operation -- sort, xform, eval, even another collate. This makes it the right tool when you need per-group processing that goes beyond simple aggregation.

The sub-operation is specified after a `--` separator. Everything after `--` is passed to the nested operation.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | Comma-separated list of key fields for grouping. May be a key spec or key group. |
| `--line-key` / `-L` | Use the value of this key as line input for the nested operation (rather than the entire record). Useful with `recs-from*` operations. |
| `--adjacent` | Only group together adjacent records. Avoids spooling records into memory. |
| `--size` / `-n` | Number of running clumps (groups) to keep active. |
| `--cube` | Enable cube mode: process all combinations of key values. |

## Examples

### Tag lines with per-thread counts
```bash
recs multiplex -k thread -- recs eval 'r.nbr = ++nbr'
```

### Sort within each group
```bash
recs multiplex -k category -- recs sort -k score=numeric
```

### Run a sub-pipeline per group using line-key
```bash
recs fromre '^(.*PID=([0-9]*).*)$' -f line,pid \
  | recs multiplex -L line -k pid -- recs frommultire ...
```

### Compute per-host statistics with a nested collate
```bash
recs multiplex -k host -- recs collate -a avg_latency=avg,latency -a max_latency=max,latency
```

### Use adjacent mode for streaming grouping
```bash
recs multiplex --adjacent -k session_id -- recs xform 'r.duration = r.end_time - r.start_time'
```

## Clumpers

Like `collate`, `multiplex` supports the full range of clumping strategies:

| Clumper | Description |
|---------|-------------|
| `keyperfect` | Group by exact key value (default) |
| `keylru` | Group by key with LRU eviction |
| `cubekeyperfect` | Group by key with cube combinations |
| `window` | Rolling window of N consecutive records |

## See Also

- [collate](./collate) - Group and aggregate records (simpler but less flexible)
- [chain](./chain) - Run an in-memory pipeline (no grouping)
- [substream](./substream) - Filter to a range of records
- [xform](./xform) - Transform individual records
