# collate

Group records and compute aggregate statistics -- the workhorse of RecordStream analytics.

## Synopsis

```bash
recs collate [options] [files...]
```

## Description

The `collate` command is arguably the most important operation in RecordStream. It takes a stream of records, groups them by one or more key fields, and computes aggregate statistics within each group. If `grep` is the "WHERE clause" of recs, then `collate` is the "GROUP BY" and everything that comes with it.

At its simplest, you specify some `--key` fields and some `--aggregator` specifications. Records sharing the same key values are grouped together, and the aggregators produce summary values for each group. The output is one record per group, containing the key fields and the aggregated values.

But `collate` goes well beyond simple grouping. It supports incremental output (emit running totals as records arrive), cubing (produce aggregations for every combination of key values, including "ALL" rollups), adjacent-only grouping (for pre-sorted data or streaming scenarios), windowed clumping, and a full domain language for building complex custom aggregators. It is, in a word, thorough.

## Options

### Grouping Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | Comma-separated list of key fields to group by. May be a key spec or key group. May be specified multiple times. |
| `--adjacent` | Only group together adjacent records with matching keys. This avoids spooling all records into memory and is ideal for pre-sorted data. Equivalent to `--size 1`. |
| `--size` / `-n` | Number of running clumps to keep active simultaneously. Use this to limit memory consumption when dealing with many distinct key values. |
| `--cube` | Enable cubing. Instead of one output record per group, produce 2^N records (where N is the number of key fields) covering every combination of actual values and "ALL". See the Cubing section below. |

### Aggregator Options

| Flag | Description |
|------|-------------|
| `--aggregator` / `-a` | Aggregator specification in the format `[name=]aggregator[,args...]`. May be specified multiple times. See the Aggregators section below. |
| `--list-aggregators` | Print the list of available aggregators and exit. |

### Output Mode Options

| Flag | Description |
|------|-------------|
| `--incremental` / `-i` | Output a record every time an input record is added to a clump, rather than waiting for the clump to finish. Useful for running totals and cumulative statistics. |
| `--bucket` | Output one record per clump (this is the default). |
| `--no-bucket` | Output one record for each original record that went into the clump, with aggregated fields appended. |

## Aggregators

Aggregators are specified as `[fieldname=]aggregator[,arguments]`. If no field name is provided, a default name is generated from the aggregator name and arguments (e.g., `count`, `sum_latency`).

The field name may be a key spec (e.g., `stats/max=max,latency`). All key name arguments to aggregators may also be key specs (e.g., `worst=max,timing/latency`).

### Available Aggregators

| Aggregator | Aliases | Arguments | Description |
|------------|---------|-----------|-------------|
| `count` | `ct` | (none) | Count records in the group |
| `sum` | | field | Sum the values of a field |
| `average` | `avg` | field | Compute the mean of a field |
| `min` | `minimum` | field | Minimum value of a field |
| `max` | `maximum` | field | Maximum value of a field |
| `mode` | | field | Most common value of a field |
| `first` | | field | First value seen for a field |
| `last` | | field | Last value seen for a field |
| `firstrec` | `firstrecord` | (none) | The entire first record in the group |
| `lastrec` | `lastrecord` | (none) | The entire last record in the group |
| `concat` | `concatenate` | delimiter, field | Concatenate all values of a field with a delimiter |
| `uconcat` | `uconcatenate` | delimiter, field | Concatenate unique values of a field |
| `array` | | field | Collect all values into an array |
| `uarray` | | field | Collect unique values into an array |
| `percentile` | `perc` | N, field | The Nth percentile value of a field |
| `percentilemap` | `percmap` | field | A map of all percentile values |
| `dcount` | `dct`, `distinctcount` | field | Count distinct values of a field |
| `countby` | `cb` | field | Count occurrences of each unique value |
| `records` | `recs` | (none) | Collect all records into an array |
| `recformax` | `recordformax` | field | The full record where a field is maximized |
| `recformin` | `recordformin` | field | The full record where a field is minimized |
| `stddev` | | field | Standard deviation of a field |
| `variance` | `var` | field | Variance of a field |
| `correlation` | `corr`, `correl` | field1, field2 | Correlation between two fields |
| `covariance` | `cov`, `covar` | field1, field2 | Covariance between two fields |
| `linearregression` | `linreg` | field1, field2 | Linear regression statistics for two fields |
| `valuestokeys` | `vk` | keyfield, valuefield | Pivot: use one field's value as a key, another as its value |

## Cubing

When `--cube` is enabled, collate outputs aggregations for every possible combination of key values. For each key field, the value is either the actual group value or the string `"ALL"`.

With two key fields `x` and `y`, you get four output records per unique (x, y) pair:

- `{x: 1, y: 2, count: ...}` -- specific group
- `{x: 1, y: "ALL", count: ...}` -- all y values for x=1
- `{x: "ALL", y: 2, count: ...}` -- all x values for y=2
- `{x: "ALL", y: "ALL", count: ...}` -- grand total

This is analogous to the `CUBE` modifier in SQL's `GROUP BY`. Do not use `--cube` with `--adjacent` or `--size`.

## Clumpers

Behind the scenes, `collate` uses "clumpers" to decide how records are grouped. The default clumper groups by exact key match (`keyperfect`). The available clumpers are:

| Clumper | Description |
|---------|-------------|
| `keyperfect` | Group records by exact key value match (default) |
| `keylru` | Group by key, with a limit on active clumps (LRU eviction) |
| `cubekeyperfect` | Group by key, additionally producing cube combinations |
| `window` | Group records by a rolling window of N consecutive records |

## Examples

### Count records by a field
```bash
recs collate --key status --aggregator count
```

### Multiple aggregators with named output fields
```bash
recs collate --key host -a request_count=count -a avg_latency=avg,latency -a p99=perc,99,latency
```

### Find the maximum latency for each date/hour pair
```bash
recs collate --key date,hour --aggregator worst_latency=max,latency
```

### Cumulative sum (running total) with incremental output
```bash
recs collate --key date --adjacent --incremental --aggregator profit_to_date=sum,profit
```

### Count with cube for rollup totals
```bash
recs collate --key region,product --aggregator count --cube
```

### Count adjacent groups (for pre-sorted data)
```bash
recs collate --adjacent --key x --aggregator count
```

### Produce a distinct list of hosts per datacenter
```bash
recs collate --key dc -a hosts=uconcat,', ',host
```

### Use no-bucket to annotate every record with its group's stats
```bash
recs collate --key team --no-bucket -a team_avg=avg,score
```

## Domain Language

For advanced use cases, collate supports a domain language that provides programmatic control over aggregators and keys. This is the power-user interface -- more flexible than the `--aggregator` syntax, but correspondingly more complex.

### Domain Language Aggregator (`--dlaggregator` / `-A`)

Specify aggregators using function-call syntax:

```bash
recs collate -A "median=perc(50, 'latency')"
```

### Domain Language Key (`--dlkey` / `-K`)

Specify computed grouping keys:

```bash
recs collate -K "tla=snip('r.name.substring(0, 3)')" -a ct
```

### Key Domain Language Functions

| Function | Description |
|----------|-------------|
| `snip(code)` | Create a valuation from a code snippet |
| `rec()` / `record()` | A valuation returning the entire record |
| `val(fn)` | Create a valuation from a function |

### Aggregator Domain Language Functions

| Function | Description |
|----------|-------------|
| `ii_agg(initial, combine, squish)` | Inject-into aggregator: start with `initial`, fold each record with `combine`, finalize with `squish` |
| `mr_agg(map, reduce, squish)` | Map-reduce aggregator: `map` each record, `reduce` pairs, finalize with `squish` |
| `for_field(regex, snippet)` | Create aggregator map for all fields matching regex |
| `subset_agg(predicate, aggregator)` | Run an aggregator only on records matching the predicate |
| `xform(aggregator, snippet)` | Transform an aggregator's result with a snippet |

### Domain Language Examples

```bash
# Find the median value of x+y across all records
recs collate --dlaggregator "m=perc(50, snip('r.x + r.y'))"

# Sum all fields starting with 't'
recs collate --dlaggregator "times=for_field(/^t/, 'sum($f)')"

# Count records where time is under 6 seconds
recs collate -A "fast=subset_agg('r.time_ms <= 6000', ct())"

# Custom inject-into aggregator for a running average
recs collate -A "myavg=ii_agg('[0, 0]', '[$a[0] + 1, $a[1] + r.value]', '$a[1] / $a[0]')"
```

## See Also

- [decollate](./decollate) - Reverse of collate: expand aggregated fields back into records
- [sort](./sort) - Sort records (often used before collate with `--adjacent`)
- [topn](./topn) - Keep top N records per group
- [multiplex](./multiplex) - Run separate operations on each group
- [grep](./grep) - Filter records before aggregation
