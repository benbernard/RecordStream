# expandjson

Expand JSON strings embedded in record fields into actual JSON values.

## Synopsis

```bash
recs expandjson [options] [files...]
```

## Description

Expand JSON strings embedded in record fields into actual JSON values. When a field contains a string that is valid JSON (object, array, etc.), this operation parses it and replaces the string with the parsed structure. With no --key options, all top-level string fields that look like JSON are expanded.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<key>` | Key containing a JSON string to expand. May be a keyspec. May be specified multiple times for multiple keys. |
| `--recursive` / `-r` | Recursively expand JSON strings found in nested values after initial expansion. |

## Examples

### Expand a metadata field containing a JSON string
```bash
recs expandjson --key metadata
```

Input:
```json
{"name":"alice","metadata":"{\"role\":\"admin\",\"level\":3}"}
```

Output:
```json
{"name":"alice","metadata":{"role":"admin","level":3}}
```

### Recursively expand nested JSON strings
```bash
recs expandjson -r --key payload
```

### Expand all JSON-like string fields automatically
```bash
recs expandjson
```

## See Also

- [flatten](./flatten)
- [eval](./eval)
