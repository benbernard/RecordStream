# substream

Filter to a range of records delimited by begin and end conditions.

## Synopsis

```bash
recs substream [options] [files...]
```

## Description

The `substream` command is the record equivalent of a bistable flip-flop. It starts in the "off" state, discarding records. When the `--begin` snippet becomes true, it flips "on" and starts emitting records. It stays on until the `--end` snippet becomes true, at which point it emits that final matching record and flips back off. The range is inclusive on both ends: `[begin, end]`.

This is the tool for extracting a time window from a log, slicing out a section of data between two markers, or grabbing everything from "the interesting part started" to "the interesting part ended." If you have ever used Perl's `..` range operator or AWK's pattern ranges, this is the same idea.

If `--begin` is omitted, output starts from the beginning of the stream (the flip-flop starts "on"). If `--end` is omitted, output continues to the end of the stream. Omitting both makes substream a very expensive no-op.

## Options

| Flag | Description |
|------|-------------|
| `--begin` / `-b` | Begin outputting records when this snippet becomes true. If omitted, output starts immediately. |
| `--end` / `-e` | Stop outputting records after this snippet becomes true. The end record is included in output. If omitted, output continues to end of stream. |

Inside the snippets, `r` is the current record object.

## Examples

### Extract records for a specific minute
```bash
recs substream \
  -b '/2013-11-07 22:42/.test(r.EndTime)' \
  -e '!/2013-11-07 22:42/.test(r.EndTime)'
```

### Truncate the stream after a specific date
```bash
recs substream -e '/Nov 07/.test(r.EndTime)'
```

### Start from when errors begin appearing
```bash
recs substream -b 'r.error_count > 0'
```

### Extract a numbered range of records
```bash
recs substream -b 'r.id >= 1000' -e 'r.id >= 2000'
```

### Skip the header section of a log, keep everything after
```bash
recs substream -b 'r.line === "--- BEGIN DATA ---"'
```

### Pipeline: extract a time window and analyze it
```bash
recs fromcsv access.log \
  | recs substream -b 'r.timestamp >= "2024-01-15T10:00"' -e 'r.timestamp >= "2024-01-15T11:00"' \
  | recs collate -a count -a avg_latency=avg,latency
```

## Notes

If no records match (the begin condition is never satisfied), substream sets a non-zero exit code.

After the end condition is met, processing stops. Records after the end range are not even read. This makes `substream` efficient for extracting early portions of large files.

## See Also

- [grep](./grep) - Filter records by predicate (keeps all matching records, not just a range)
- [topn](./topn) - Keep the first N records per group
- [assert](./assert) - Enforce conditions on records
