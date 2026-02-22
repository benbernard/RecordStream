# tojsonarray

Output the record stream as a single JSON array.

## Synopsis

```bash
recs tojsonarray [files...]
```

## Description

The `tojsonarray` command wraps your entire record stream into a single JSON array. Where the default recs output format is newline-delimited JSON (one JSON object per line), `tojsonarray` produces a well-formed JSON array that any standard JSON parser can consume. The first record gets a `[` prefix, intermediate records get commas, and the stream closes with `]`.

This is the inverse of `fromjsonarray`. Together they form a round-trip: you can serialize a record stream to a JSON array file and later read it back in. The output is also ideal for feeding into web APIs, JavaScript applications, or any system that expects a JSON array rather than line-delimited JSON.

The command takes no special options -- it simply collects every record it sees and wraps them in array syntax. If the input stream is empty, it outputs `[]`. Straightforward, no surprises, just the way serialization should be.

## Options

| Flag | Description |
|------|-------------|
| `--filename-key` / `--fk` | Add a key with the source filename (puts `NONE` if not applicable). |

This command has no additional options. It does exactly one thing, and it does it well.

## Examples

### Save records as a JSON array
```bash
cat data.jsonl | recs tojsonarray > data.json
```
Converts newline-delimited JSON records into a single JSON array file.

### Round-trip with fromjsonarray
```bash
cat data.jsonl | recs tojsonarray | recs fromjsonarray
```
Serializes to a JSON array and immediately deserializes back. The output should match the input, which is a reassuring property for any serialization format.

### Pipe to a web API
```bash
recs fromps --fields pid,command,rss | recs tojsonarray | \
  curl -X POST -H 'Content-Type: application/json' -d @- https://api.example.com/processes
```
Captures running processes and posts them as a JSON array to an API endpoint.

### Create a JSON fixture file
```bash
recs fromcsv test-data.csv | recs tojsonarray > fixtures/test-data.json
```
Converts CSV test data into a JSON array suitable for use as a test fixture. Your test suite will appreciate the structured format.

### Empty input produces empty array
```bash
echo -n | recs tojsonarray
```
Outputs `[]`. No records in, empty array out. The mathematicians in the audience will appreciate the identity element.

## See Also

- [fromjsonarray](./fromjsonarray) - The inverse: parse a JSON array into individual records
- [toprettyprint](./toprettyprint) - Pretty-print records for human inspection
