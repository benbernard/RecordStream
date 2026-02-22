# sort

Sort records by one or more keys.

## Synopsis

```bash
recs sort [options] [files...]
```

## Description

The `sort` command does exactly what it says: it sorts records. You specify one or more key fields, each with an optional sort type, and records are ordered accordingly. It is the `ORDER BY` of RecordStream.

By default, fields are sorted lexically (alphabetical order). You can specify numeric sorting for fields that contain numbers, which avoids the classic trap where "9" sorts after "100" in lexical order. You can also mix sort types across multiple keys and reverse the direction per-key or globally.

Since sorting requires reading all records before producing any output, `sort` spools the entire input into memory. For very large datasets, consider whether you truly need a full sort or whether `topn` (which only keeps the top N) would suffice.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | Sort key specification. May be a field name or `field=sortType`. Multiple keys can be comma-separated or specified with multiple `--key` flags. See Sort Types below. |
| `--reverse` / `-r` | Reverse the entire sort order. |

### Sort Types

Each key can have a sort type suffix after an `=` sign:

| Type | Aliases | Description |
|------|---------|-------------|
| `lexical` | `lex`, `l` | Alphabetical order (default) |
| `numeric` | `nat`, `n` | Numeric order |
| `-lexical` | `-lex`, `-l` | Descending alphabetical |
| `-numeric` | `-nat`, `-n` | Descending numeric |

You can also append `*` to any sort type to sort the special value `"ALL"` to the end, which is useful when working with output from `recs collate --cube`.

## Examples

### Sort by a single field (lexical, the default)
```bash
recs sort --key name
```

### Sort numerically by id
```bash
recs sort --key id=numeric
```

### Sort by multiple fields: age (numeric), then name (lexical)
```bash
recs sort --key age=numeric,name
```

### Sort by decreasing size, then by name
```bash
recs sort --key size=-numeric --key name
```

### Reverse the entire sort
```bash
recs sort --reverse --key timestamp=numeric
```

### Sort cube output with ALL values at the end
```bash
recs collate --key region --cube -a count \
  | recs sort --key region=lexical*
```

### Pipeline: sort then take top 10
```bash
recs sort --key score=-numeric | recs topn -n 10
```

### Multi-key pipeline
```bash
recs fromcsv employees.csv \
  | recs sort --key department,salary=-numeric \
  | recs topn -n 3 --key department
```

## See Also

- [topn](./topn) - Output top N records (often paired with sort)
- [collate](./collate) - Group and aggregate (use `--adjacent` on sorted data)
- [delta](./delta) - Compute differences (expects sorted input)
