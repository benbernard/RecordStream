# flatten

Flatten nested hash/array structures in records into top-level fields.

## Synopsis

```bash
recs flatten [options] [files...]
```

## Description

Flatten nested hash/array structures in records into top-level fields. Note: this implements a strategy for dealing with nested structures that is almost always better handled by using keyspecs or keygroups.

## Options

| Flag | Description |
|------|-------------|
| `--depth` `<number>` | Change the default flatten depth. Negative values mean arbitrary depth. Default is 1. |
| `--key` / `-k` `<fields>` | Comma-separated list of fields to flatten at the default depth. |
| `--deep` `<fields>` | Comma-separated list of fields to flatten to arbitrary depth. |
| `--separator` `<string>` | String used to separate joined field names. Default is '-'. |

## Examples

### Flatten a nested field one level deep
```bash
recs flatten -k field
```

Input:
```json
{"field":{"subfield":"value"}}
```

Output:
```json
{"field-subfield":"value"}
```

### Flatten a deeply nested structure to arbitrary depth
```bash
recs flatten --deep x
```

Input:
```json
{"x":{"y":[{"z":"v"}]}}
```

Output:
```json
{"x-y-0-z":"v"}
```

## See Also

- [xform](./xform)
- [stream2table](./stream2table)
