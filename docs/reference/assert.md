# assert

Abort the pipeline if a condition fails on any record.

## Synopsis

```bash
recs assert [options] <expression> [files...]
```

## Description

The `assert` command evaluates a JavaScript expression on every record in the stream. If the expression returns a falsy value for any record, processing immediately halts and an error message is printed to stderr. If all records pass, they flow through unchanged -- `assert` is invisible when everything is fine.

This is the quality control inspector of your pipeline. Place it anywhere in a chain of recs commands to enforce invariants: every record must have a date field, no latency should exceed 10 seconds, all status codes must be 200. If your data misbehaves, you will hear about it loudly and immediately rather than discovering garbage at the end.

Unlike `grep`, which silently drops non-matching records, `assert` treats a non-match as a hard failure. It is a guardrail, not a filter.

## Options

| Flag | Description |
|------|-------------|
| `--diagnostic` / `-d` | Include this diagnostic string in the error message when an assertion fails. Useful for distinguishing between multiple asserts in a pipeline. |
| `--verbose` / `-v` | Dump the offending record in full when an assertion fails. Handy for debugging, though it may produce large output for records with many fields. |

The expression is provided as a positional argument. Inside the snippet, `r` is the current record object.

## Examples

### Require every record to have a "date" field
```bash
recs assert 'r.date !== undefined'
```

### Ensure no latency exceeds 10 seconds, with verbose debugging
```bash
recs assert -v -d 'latency check' 'r.latency < 10000'
```

### Validate that status codes are in the 2xx range
```bash
recs assert -d 'HTTP status' 'r.status >= 200 && r.status < 300'
```

### Place asserts in a pipeline to catch problems early
```bash
recs fromcsv data.csv \
  | recs assert 'r.user_id' \
  | recs collate -k user_id -a count \
  | recs sort -k count=numeric
```

## See Also

- [grep](./grep) - Filter records by predicate (non-matching records are dropped, not fatal)
- [xform](./xform) - Transform records arbitrarily
