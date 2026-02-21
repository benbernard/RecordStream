# decollate

Expand aggregated fields back into individual records -- the reverse of collate.

## Synopsis

```bash
recs decollate [options] [files...]
```

## Description

The `decollate` command is the undo button for `collate`. Where `collate` gathers many records into summary statistics, `decollate` takes those summaries and splits them back out into multiple records. It uses "deaggregators" to determine how fields should be expanded.

The most common scenario is splitting a concatenated string field back into individual records, or expanding an array field so each element becomes its own record. If `collate` compressed your data, `decollate` decompresses it.

Deaggregators are specified with the `--deaggregator` / `-d` flag, using a colon-separated list of deaggregator specifications.

## Options

| Flag | Description |
|------|-------------|
| `--deaggregator` / `-d` | Deaggregator specification. Colon-separated list of deaggregator specs. May be specified multiple times. |
| `--list-deaggregators` | Print the list of available deaggregators and exit. |

## Available Deaggregators

| Deaggregator | Description |
|--------------|-------------|
| `split` | Split a string field on a delimiter into separate records |
| `unarray` | Expand an array field so each element becomes its own record |
| `unhash` | Expand a hash/object field so each key-value pair becomes its own record |

## Examples

### Split a comma-separated "hosts" field into individual records
```bash
recs decollate -d 'split,hosts,",",host'
```

### Expand an array field into separate records
```bash
recs decollate -d 'unarray,items,item'
```

### Expand a hash into key-value pair records
```bash
recs decollate -d 'unhash,stats,stat_name,stat_value'
```

### Round-trip: collate then decollate
```bash
# First, gather hosts per datacenter
recs collate --key dc -a hosts=uconcat,', ',host

# Later, split them back out
recs decollate -d 'split,hosts,", ",host'
```

## See Also

- [collate](./collate) - Group and aggregate records (the forward direction)
- [flatten](./flatten) - Flatten nested structures (different approach to denormalization)
- [generate](./generate) - Generate new records from existing ones
