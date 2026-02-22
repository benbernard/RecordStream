# collate

Take records, grouped together by --keys, and compute statistics (like average, count, sum, concat, etc.) within those groups.

## Synopsis

```bash
recs collate [options] [files...]
```

## Description

Take records, grouped together by --keys, and compute statistics (like average, count, sum, concat, etc.) within those groups.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<keys>` | Comma-separated list of key fields for grouping. May be a key spec or key group. |
| `--aggregator` / `-a` `<aggregators>` | Colon-separated aggregator specification in the form [&lt;fieldname&gt;=]&lt;aggregator&gt;[,&lt;arguments&gt;]. |
| `--dlaggregator` / `-A` `<name>=<expression>` | Domain language aggregator in the form name=expression. The expression is evaluated as JavaScript to produce an aggregator. |
| `--mr-agg` `<name> <map> <reduce> <squish>` | MapReduce aggregator: takes 4 arguments: name, map snippet, reduce snippet, squish snippet. |
| `--ii-agg` `<name> <initial> <combine> <squish>` | InjectInto aggregator: takes 4 arguments: name, initial snippet, combine snippet, squish snippet. |
| `--dlkey` / `-K` `<name>=<expression>` | Domain language key: name=expression where the expression evaluates as a valuation. |
| `--incremental` / `-i` | Output a record every time an input record is added to a clump (instead of every time a clump is flushed). |
| `--bucket` | Output one record per clump (default). |
| `--no-bucket` | Output one record for each record that went into the clump. |
| `--adjacent` / `-1` | Only group together adjacent records. Avoids spooling records into memory. |
| `--size` / `--sz` / `-n` `<number>` | Number of running clumps to keep. |
| `--cube` | Enable cube mode: output all key combinations with ALL placeholders. |
| `--clumper` / `-c` `<spec>` | Clumper specification (e.g. keylru,field,size or keyperfect,field or window,size). |
| `--dlclumper` / `-C` `<expression>` | Domain language clumper specification. |
| `--perfect` | Group records regardless of order (perfect hashing). |
| `--list-aggregators` | List available aggregators and exit. |
| `--show-aggregator` `<name>` | Show details of a specific aggregator and exit. |
| `--list-clumpers` | List available clumpers and exit. |
| `--show-clumper` `<name>` | Show details of a specific clumper and exit. |

## Examples

### Count number of each x field value in the entire file
```bash
recs collate --key x --aggregator count
```

### Find the maximum latency for each date, hour pair
```bash
recs collate --key date,hour --aggregator worst_latency=max,latency
```

### Produce a cumulative sum of profit up to each date
```bash
recs collate --key date --adjacent --incremental --aggregator profit_to_date=sum,profit
```

### Count clumps of adjacent lines with matching x fields
```bash
recs collate --adjacent --key x --aggregator count
```

## See Also

- [decollate](./decollate)
- [sort](./sort)
- [multiplex](./multiplex)
