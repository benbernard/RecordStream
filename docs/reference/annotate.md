# annotate

Add computed fields to records, caching the result by key so expensive operations run only once per unique key value.

## Synopsis

```bash
recs annotate [options] <expression> [files...]
```

## Description

The `annotate` command evaluates a JavaScript snippet on each record, then monitors what fields changed. It caches those changes, keyed by the values of the `--key` fields. When a record with the same key values appears later, the cached annotation is applied directly, skipping re-evaluation.

This is particularly useful when you have a field like an IP address or filename that appears many times in your data and you need to compute something expensive (like a DNS lookup or file hash) for each unique value. Rather than recomputing every time, `annotate` does the work once and replays the result.

If you do not have repeated key values, `xform` will be faster because it skips the caching overhead entirely. Think of `annotate` as "`xform` with memoization."

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | Keys to match records by. May be specified multiple times. May be a key group or key spec. Records with the same values for these keys will receive the same annotation. Required. |

The expression is provided as a positional argument. Inside the snippet, `r` is the current record object and you can use `r.fieldName` or `r['fieldName']` to access fields.

## Examples

### Annotate records with hostnames based on IP (runs lookup once per unique IP)
```bash
recs annotate --key ip 'r.hostname = lookupHost(r.ip)' access.log
```

### Add MD5 checksums keyed by filename
```bash
recs annotate --key filename 'r.md5 = computeHash(r.filename)'
```

### Tag user records with department info from a slow API
```bash
recs annotate --key user_id 'r.department = fetchDepartment(r.user_id)'
```

## Notes

Because annotations are cached as a diff of what changed in the record, some operations may not replay perfectly. Specifically, removing fields or reordering arrays may not be captured in the annotation. If you need that kind of mutation, use `xform` instead.

## See Also

- [xform](./xform) - General-purpose record transformation (no caching)
- [collate](./collate) - Group and aggregate records
- [grep](./grep) - Filter records by predicate
