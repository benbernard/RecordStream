# generate

Generate new records from a snippet evaluated on each input record.

## Synopsis

```bash
recs generate [options] <expression> [files...]
```

## Description

The `generate` command is a record multiplier. For each input record, it evaluates a JavaScript expression that returns one or more new records. Each generated record automatically receives a `_chain` field linking it back to the input record that spawned it, preserving the lineage of your data.

This is the tool for fan-out operations: given a record describing a user, generate records for all their transactions; given a URL, fetch and parse its contents into child records. The chain link lets you trace any generated record back to its origin.

In the TypeScript version, the snippet returns records (or arrays of records) directly. The chain key is added to each generated record with the full input record as its value.

## Options

| Flag | Description |
|------|-------------|
| `--keychain` | Name of the chain link field. Default is `_chain`. May be a key spec. |
| `--passthrough` | Emit the input record as well as the generated records. Without this flag, only the generated records appear in the output. |

The expression is provided as a positional argument. Inside the snippet, `r` is the current record object. The expression should return a record, an object, or an array of records/objects.

## Examples

### Generate child records from an array field
```bash
recs generate 'r.items.map(item => ({name: item, category: r.category}))'
```

### Expand a record into multiple rows with passthrough
```bash
recs generate --passthrough 'r.tags.map(t => ({tag: t}))'
```

### Use a custom chain key name
```bash
recs generate --keychain source 'r.urls.map(u => ({url: u}))'
```

### Access the chain link in downstream operations
```bash
recs generate 'r.items.map(i => ({item: i}))' \
  | recs xform 'r.parent_id = r._chain.id'
```

### Generate records conditionally
```bash
recs generate '
  if (r.type === "multi") {
    return r.values.map(v => ({value: v}));
  }
  return [{value: r.value}];
'
```

## See Also

- [xform](./xform) - Transform records (can also produce multiple output records)
- [decollate](./decollate) - Expand aggregated fields into records
- [multiplex](./multiplex) - Run sub-pipelines for grouped records
