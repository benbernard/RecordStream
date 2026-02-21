# fromjsonarray

Import records from a JSON array.

## Synopsis

```bash
recs fromjsonarray [options] [files...]
```

## Description

`fromjsonarray` reads a JSON file containing an array of objects and emits one record per object. This is the command you reach for when some API or export tool hands you a `[{...}, {...}, ...]` file and you need to feed it into a recs pipeline.

By default, every key in each JSON object becomes a field in the output record. If you only care about specific fields, pass `--key` to select them and the rest will be ignored. This is purely a convenience -- you could achieve the same thing with a downstream `recs xform`, but doing it at the source is cleaner and slightly faster.

Note that this command expects the entire input to be a single JSON array. If your data is newline-delimited JSON (one JSON object per line), you do not need this command at all -- that is recs' native format and can be piped directly into any recs command.

## Options

| Flag | Description |
|------|-------------|
| `--key <keys>` / `-k <keys>` | Comma-separated list of field names to extract from each object. May be specified multiple times. Supports key specs. If omitted, all keys are included. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename. |

## Examples

### Import all objects from a JSON array file
```bash
recs fromjsonarray data.json
```

### Extract only specific fields
```bash
recs fromjsonarray --key name,email,role users.json
```

### Process an API response saved to a file
```bash
curl -s "https://api.example.com/users" > /tmp/users.json
recs fromjsonarray /tmp/users.json \
  | recs grep '{{role}} eq "admin"'
```

### Combine multiple JSON array files
```bash
recs fromjsonarray results_page1.json results_page2.json results_page3.json \
  | recs collate --aggregator count
```

### Use key specs to extract nested fields
```bash
recs fromjsonarray --key name,address/city users.json
```

## Notes

- The entire file is read into memory and parsed as JSON, so extremely large files (multiple gigabytes) may be problematic. For streaming JSON processing, consider converting to newline-delimited JSON first.
- Non-object items in the array (strings, numbers, nulls) are silently skipped.

## See Also

- [tojsonarray](./tojsonarray) - Output records as a JSON array (the inverse operation)
- [fromcsv](./fromcsv) - Parse CSV if your data is tabular rather than JSON
- [fromxml](./fromxml) - Parse XML data sources
