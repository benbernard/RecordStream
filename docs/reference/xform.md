# xform

Transform records with an arbitrary JavaScript snippet -- the Swiss Army knife of RecordStream.

## Synopsis

```bash
recs xform [options] <expression> [files...]
```

## Description

The `xform` command is the general-purpose record transformation tool. It evaluates a JavaScript snippet on each record, and the (possibly modified) record is output. If you can express your transformation in code, `xform` can do it.

The snippet receives the record as `r`. You can modify fields in place (`r.new_field = r.old * 2`), and the modified record is output. But `xform` goes further: if you return an array, each element becomes a separate output record. If you call `push_output()` with no arguments, the current record is suppressed (making `xform` act like a filter). If you call `push_output(record)`, that record is emitted (and the original is suppressed unless you explicitly push it too).

You also get access to surrounding records via the `-A`, `-B`, and `-C` flags, which make records before and after the current one available for cross-record calculations. And `--pre-snippet` and `--post-snippet` let you run code at the start and end of the stream.

## Options

| Flag | Description |
|------|-------------|
| `--before` / `-B` | Make NUM records before the current one available in the `B` array (closest record first). |
| `--after` / `-A` | Make NUM records after the current one available in the `A` array (closest record first). |
| `--context` / `-C` | Shorthand for `-A NUM -B NUM`. Makes NUM records available in both directions. |
| `--pre-snippet` | A snippet to run once before the first record is processed. Useful for initializing state. |
| `--post-snippet` | A snippet to run once after all records have been processed. Useful for emitting summary records. |

The expression is provided as a positional argument. Inside the snippet:
- `r` is the current record
- `B` is an array of preceding records (if `-B` is used)
- `A` is an array of following records (if `-A` is used)
- `filename` is the source filename
- `line` is the current record number (starting at 1)

## Examples

### Add a line number to each record
```bash
recs xform 'r.line = line'
```

### Rename a field and remove another
```bash
recs xform 'r.new_name = r.old_name; delete r.old_name; delete r.unwanted'
```

### Compute a derived field
```bash
recs xform 'r.duration_seconds = r.duration_ms / 1000'
```

### Keep only specific fields
```bash
recs xform 'r = {name: r.name, score: r.score}'
```

### Double every record (emit two copies)
```bash
recs xform 'return [{...r.toJSON()}, {...r.toJSON()}]'
```

### Double records with the function interface
```bash
recs xform 'push_output(r, r)'
```

### Conditionally suppress records (act like grep)
```bash
recs xform 'if (r.status < 200) return null'
```

### Use before-context to access the previous record
```bash
recs xform -B 1 'r.prev_value = B[0] ? B[0].value : null'
```

### Use a pre-snippet to initialize state
```bash
recs xform --pre-snippet 'let total = 0' 'total += r.amount; r.running_total = total'
```

### Use a post-snippet to emit a summary
```bash
recs xform \
  --pre-snippet 'let count = 0; let sum = 0' \
  --post-snippet 'push_output({type: "summary", count, average: sum/count})' \
  'count++; sum += r.value'
```

### Pipeline: parse, transform, and analyze
```bash
recs fromcsv sales.csv \
  | recs xform 'r.revenue = r.quantity * r.unit_price; r.quarter = Math.ceil(r.month / 3)' \
  | recs collate -k quarter -a total_revenue=sum,revenue -a count
```

### Format timestamps
```bash
recs xform 'r.date = new Date(r.epoch * 1000).toISOString()'
```

### Merge nested fields to top level
```bash
recs xform 'Object.assign(r, r.metadata); delete r.metadata'
```

## Notes

When using `-A`, `-B`, or `-C`, xform must buffer records to provide the context window. This adds memory overhead proportional to the context size.

The `push_output()` and `push_input()` helper methods provide advanced flow control. `push_output(record)` adds a record to the output queue and suppresses the default output of the current record. `push_input(record)` adds a record to the input queue, causing it to be processed next. Use these sparingly -- they are powerful but can make your pipeline logic harder to follow.

## See Also

- [grep](./grep) - Filter records (simpler than xform for pure filtering)
- [annotate](./annotate) - Transform with caching by key (faster for repeated values)
- [eval](./eval) - Evaluate snippet and output plain text (not records)
- [generate](./generate) - Generate new records with chain links
- [collate](./collate) - Group and aggregate records
