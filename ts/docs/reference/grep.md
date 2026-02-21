# grep

Filter records where a predicate expression evaluates to true.

## Synopsis

```bash
recs grep [options] <expression> [files...]
```

## Description

The `grep` command is the filter of RecordStream. It evaluates a JavaScript expression on each record and passes through only the records where the expression returns a truthy value. Non-matching records are silently discarded. If you have used Unix `grep` or SQL's `WHERE` clause, you already understand the concept.

Like its Unix namesake, `grep` supports context flags (`-A`, `-B`, `-C`) that let you include surrounding records around each match. This is invaluable for debugging: if you find an error record, you probably want to see the few records before and after it for context. There is also an invert-match flag (`-v`) to keep everything that does NOT match.

If no records match the expression, `grep` sets a non-zero exit code, following the Unix convention. Your pipeline continues either way, but scripts can check the exit status.

## Options

| Flag | Description |
|------|-------------|
| `--invert-match` / `-v` | Anti-match. Records NOT matching the expression will be returned instead. |
| `--context` / `-C` | Provide NUM records of context around each match. Equivalent to `-A NUM -B NUM`. |
| `--after-context` / `-A` | Print NUM records following each match. |
| `--before-context` / `-B` | Print the previous NUM records when a match occurs. |

The expression is provided as a positional argument. Inside the snippet, `r` is the current record object.

## Examples

### Filter records where name is "John"
```bash
recs grep 'r.name === "John"'
```

### Find records where status is NOT 200
```bash
recs grep -v 'r.status === 200'
```

### Filter by numeric comparison
```bash
recs grep 'r.latency > 1000'
```

### Use regex matching on a field
```bash
recs grep '/^error/i.test(r.message)'
```

### Show 2 records of context around each error
```bash
recs grep -C 2 'r.level === "ERROR"'
```

### Show 5 records before each timeout (for root-cause analysis)
```bash
recs grep -B 5 'r.error === "timeout"'
```

### Complex predicate with multiple conditions
```bash
recs grep 'r.status >= 500 && r.method === "POST" && r.latency > 5000'
```

### Filter based on array contents
```bash
recs grep 'r.tags && r.tags.includes("production")'
```

### Pipeline: find slow requests then analyze them
```bash
recs fromcsv requests.csv \
  | recs grep 'r.duration_ms > 10000' \
  | recs collate -k endpoint -a count -a p99=perc,99,duration_ms
```

## See Also

- [assert](./assert) - Like grep, but aborts the pipeline on non-match instead of filtering
- [xform](./xform) - Transform records (can conditionally suppress output)
- [substream](./substream) - Filter to a range of records between begin/end conditions
- [collate](./collate) - Aggregate records after filtering
