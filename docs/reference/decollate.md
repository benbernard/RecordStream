# decollate

Reverse of collate: takes a single record and produces multiple records using deaggregators.

## Synopsis

```bash
recs decollate [options] [files...]
```

## Description

Reverse of collate: takes a single record and produces multiple records using deaggregators. Decollate records of input into output records.

## Options

| Flag | Description |
|------|-------------|
| `--deaggregator` / `-d` `<deaggregators>` | Deaggregator specification (colon-separated). |
| `--list-deaggregators` | List available deaggregators and exit. |

## Examples

### Split the 'hosts' field into individual 'host' fields
```bash
recs decollate --deaggregator 'split,hosts,/\s*,\s*/,host'
```

## See Also

- [collate](./collate)
