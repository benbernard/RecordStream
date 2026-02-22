# join

Join two record streams on a key.

## Synopsis

```bash
recs join [options] <inputkey> <dbkey> <dbfile> [files...]
```

## Description

Join two record streams on a key. Records of input are joined against records in dbfile, using field inputkey from input and field dbkey from dbfile. Each pair of matches will be combined to form a larger record, with fields from the dbfile overwriting fields from the input stream.

## Options

| Flag | Description |
|------|-------------|
| `--left` | Do a left join (include unmatched db records). |
| `--right` | Do a right join (include unmatched input records). |
| `--inner` | Do an inner join (default). Only matched pairs are output. |
| `--outer` | Do an outer join (include all unmatched records from both sides). |
| `--operation` `<expression>` | A JS expression for merging two records together, in place of the default behavior of db fields overwriting input fields. Variables d and i are the db record and input record respectively. |
| `--accumulate-right` | Accumulate all input records with the same key onto each db record matching that key. |

## Examples

### Join type from input and typeName from dbfile
```bash
cat recs | recs join type typeName dbfile
```

### Join host name from a mapping file to machines
```bash
recs join host host hostIpMapping machines
```

## See Also

- [collate](./collate)
- [xform](./xform)
