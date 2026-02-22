# grep

Filter records where an expression evaluates to true.

## Synopsis

```bash
recs grep [options] <expression> [files...]
```

## Description

Filter records where an expression evaluates to true. The expression is evaluated on each record with r set to the current Record object and line set to the current line number (starting at 1). Records for which the expression is truthy are passed through.

## Options

| Flag | Description |
|------|-------------|
| `--invert-match` / `-v` | Anti-match: records NOT matching the expression will be returned. |
| `--context` / `-C` `<NUM>` | Provide NUM records of context around matches (equivalent to -A NUM and -B NUM). |
| `--after-context` / `-A` `<NUM>` | Print out NUM following records after a match. |
| `--before-context` / `-B` `<NUM>` | Print out the previous NUM records on a match. |
| `--lang` / `-l` `<lang>` | Snippet language: js (default), python/py, perl/pl. |

## Examples

### Filter to records with field 'name' equal to 'John'
```bash
recs grep 'r.name === "John"'
```

### Find records without ppid equal to 3456
```bash
recs grep -v 'r.ppid === 3456'
```

### Filter using Python
```bash
recs grep --lang python 'r["age"] > 30'
```

## See Also

- [xform](./xform)
- [assert](./assert)
- [substream](./substream)
