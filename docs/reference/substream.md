# substream

Filter to a range of records delimited from when the begin snippet becomes true to when the end snippet becomes true, i.e.

## Synopsis

```bash
recs substream [options] [files...]
```

## Description

Filter to a range of records delimited from when the begin snippet becomes true to when the end snippet becomes true, i.e. [begin, end]. Compare to Perl's inclusive, bistable ".." range operator.

## Options

| Flag | Description |
|------|-------------|
| `--begin` / `-b` `<snippet>` | Begin outputting records when this snippet becomes true. If omitted, output starts from the beginning of the stream. |
| `--end` / `-e` `<snippet>` | Stop outputting records after this snippet becomes true. If omitted, outputs to the end of the stream. |

## Examples

### Filter to records within a specific time window
```bash
recs substream -b 'r.time >= "2013-11-07 22:42"' -e 'r.time > "2013-11-07 22:43"'
```

### Truncate past a specific date
```bash
recs substream -e 'r.endTime.includes("Nov 07")'
```

## See Also

- [grep](./grep)
