# stream2table

Transforms a list of records, combining records based on a column field.

## Synopsis

```bash
recs stream2table [options] [files...]
```

## Description

Transforms a list of records, combining records based on a column field. In order, the values of the column will be added to the output records. Note: this script spools the stream into memory. The full input record will be associated with the value of the field. The field itself will be removed from the nested record if it is not a key spec.

## Options

| Flag | Description |
|------|-------------|
| `--field` / `-f` `<FIELD>` | Field to use as the column key. May be a keyspec. **(required)** |

## Examples

### Transform a record stream with each stat on one line to a stream with one value for each stat present on one line
```bash
recs stream2table --field stat
```

### Combine records by column field
```bash
recs stream2table --field column
```

Input:
```json
{"column":"foo","data":"foo1"}
{"column":"foo","data":"foo2"}
{"column":"boo","data":"boo1"}
{"column":"boo","data":"boo2"}
```

Output:
```json
{"boo":{"data":"boo1"},"foo":{"data":"foo1"}}
{"boo":{"data":"boo2"},"foo":{"data":"foo2"}}
```

## See Also

- [flatten](./flatten)
- [collate](./collate)
