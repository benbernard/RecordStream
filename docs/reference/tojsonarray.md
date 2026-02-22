# tojsonarray

Outputs the record stream as a single JSON array.

## Synopsis

```bash
recs tojsonarray [files...]
```

## Description

Outputs the record stream as a single JSON array. Complements the fromjsonarray command.

## Examples

### Save the record stream to a file suitable for loading by any JSON parser
```bash
... | recs tojsonarray > recs.json
```

## See Also

- [fromjsonarray](./fromjsonarray)
