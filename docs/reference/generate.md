# generate

Execute an expression for each record to generate new records.

## Synopsis

```bash
recs generate [options] <expression> [files...]
```

## Description

Execute an expression for each record to generate new records. The expression should return an array of new record objects (or a single record). Each generated record gets a chain link back to the original input record under the '_chain' key (configurable via --keychain).

## Options

| Flag | Description |
|------|-------------|
| `--keychain` `<name>` | Key name for the chain link back to the original record. Default is '_chain'. May be a key spec. |
| `--passthrough` | Emit the input record in addition to the generated records. |

## Examples

### Generate sub-records from a feed and chain back to the original
```bash
recs generate 'fetchFeed(r.url).map(item => ({ title: item.title }))'
```

## See Also

- [xform](./xform)
- [chain](./chain)
