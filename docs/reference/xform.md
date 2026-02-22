# xform

Transform records with a JS snippet.

## Synopsis

```bash
recs xform [options] <expression> [files...]
```

## Description

Transform records with a JS snippet. The expression is evaluated on each record with r set to the current Record object. If the expression returns an array, each element becomes a separate output record. Otherwise the (possibly mutated) record is output. You can also use push_output and push_input to control record flow.

## Options

| Flag | Description |
|------|-------------|
| `--before` / `-B` `<NUM>` | Make NUM records before this one available in the B array. |
| `--after` / `-A` `<NUM>` | Make NUM records after this one available in the A array. |
| `--context` / `-C` `<NUM>` | Make NUM records available in both the A and B arrays (equivalent to -A NUM -B NUM). |
| `--post-snippet` `<snippet>` | A snippet to run once the stream has completed. |
| `--pre-snippet` `<snippet>` | A snippet to run before the stream starts. |

## Examples

### Add line number to records
```bash
recs xform 'r.line = line'
```

### Rename field old to new and remove field a
```bash
recs xform 'r.rename("old", "new"); r.remove("a")'
```

### Remove fields which are not a, b, or c
```bash
recs xform 'r.prune_to("a", "b", "c")'
```

### Move a value from the previous record to the current record
```bash
recs xform -B 1 'r.before_val = B[0]'
```

## See Also

- [grep](./grep)
- [annotate](./annotate)
- [eval](./eval)
