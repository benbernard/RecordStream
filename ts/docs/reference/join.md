# join

Join two record streams on a common key, SQL-style.

## Synopsis

```bash
recs join [options] <inputkey> <dbkey> <dbfile> [files...]
```

## Description

The `join` command combines records from two sources based on matching key values, much like a SQL JOIN. One source is the "database" (loaded from a file into memory), and the other is the input stream. For each input record, join looks up matching records in the database by comparing the specified key fields, then merges the matching pairs.

By default, join performs an inner join: only input records that have a matching database record appear in the output. The merged record contains all fields from both sources, with database fields overwriting input fields when there are name collisions. You can change this behavior with `--left`, `--right`, `--outer`, or `--operation`.

Both `inputkey` and `dbkey` may be key specs. For composite keys, separate multiple key specs with commas (e.g., `host,port`).

## Options

| Flag | Description |
|------|-------------|
| `--inner` | Perform an inner join (default). Only matching pairs are output. |
| `--left` | Perform a left join. All database records are output; unmatched db records appear alone. |
| `--right` | Perform a right join. All input records are output; unmatched input records appear alone. |
| `--outer` | Perform an outer join. All records from both sides are output; unmatched records appear alone. |
| `--operation` | A JavaScript expression for custom merge logic. `d` is the database record, `i` is the input record. The `d` record is used for output. |
| `--accumulate-right` | Accumulate all input records with the same key onto each matching db record. Most useful with `--operation`. |

## Join Types Explained

Given a database file:
```json
{"typeName": "foo", "hasSetting": 1}
{"typeName": "bar", "hasSetting": 0}
```

And an input stream:
```json
{"name": "something", "type": "foo"}
{"name": "blarg", "type": "hip"}
```

With `recs join type typeName dbfile`:

| Join Type | Output |
|-----------|--------|
| **inner** (default) | Only `something` (matches `foo`) |
| **outer** | `something` + `blarg` (unmatched input) + `bar` (unmatched db) |
| **left** | `something` + `bar` (all db records, only matched input) |
| **right** | `something` + `blarg` (all input records, only matched db) |

## Examples

### Basic inner join
```bash
cat records.json | recs join type typeName dbfile.json
```

### Join with composite keys
```bash
recs join host,port host,port server-metadata.json < connections.json
```

### Left join to include all database records
```bash
recs join --left user_id id users.json < events.json
```

### Outer join to see everything
```bash
recs join --outer name name reference.json < input.json
```

### Custom merge operation
```bash
recs join --operation 'd.total = (d.total || 0) + i.amount' \
  --accumulate-right \
  account_id account_id accounts.json < transactions.json
```

### Pipeline: enrich log records with host metadata
```bash
recs fromcsv access.log \
  | recs join hostname hostname host-metadata.json \
  | recs collate -k datacenter -a count
```

## Notes

The database file is loaded entirely into memory, indexed by key. For very large database files, be mindful of memory usage. The input stream is processed one record at a time and is not buffered.

## See Also

- [collate](./collate) - Group and aggregate (for self-joins or aggregation after joining)
- [xform](./xform) - Arbitrary transformations (for manual merging logic)
- [multiplex](./multiplex) - Process grouped records through sub-pipelines
