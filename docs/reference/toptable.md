# toptable

Creates a multi-dimensional pivot table with any number of x and y axes.

## Synopsis

```bash
recs toptable [options] [files...]
```

## Description

Creates a multi-dimensional pivot table with any number of x and y axes. X and Y fields can take the special value 'FIELD' which uses unused field names as values for the FIELD dimension.

## Options

| Flag | Description |
|------|-------------|
| `--x-field` / `-x` `<field>` | Add an x field (column axis). Values of the specified field will become columns in the table. May be a keyspec or a keygroup. |
| `--y-field` / `-y` `<field>` | Add a y field (row axis). Values of the specified field will become rows in the table. May be a keyspec or a keygroup. |
| `--v-field` / `-v` `<field>` | Specify the value field to display in the table. If multiple value fields are specified and FIELD is not placed in the x or y axes, then the last one wins. May be a keyspec or a keygroup. |
| `--pin` / `-p` `<field=value>` | Pin a field to a certain value, only display records matching that value. Takes value of the form: field=pinnedValue. |
| `--sort` `<sort spec>` | Sort specifications for x/y values in headers. See recs sort --help for details of sort specifications. |
| `--noheaders` | Do not print row and column headers. |
| `--records` / `--recs` | Instead of printing a table, output records, one per row of the table. |
| `--sort-all-to-end` / `--sa` | Sort ALL fields to the end, equivalent to --sort FIELD=* for each --x and --y field. |

## Examples

### Collate and display in a nice table
```bash
... | recs collate --key state,priority -a count | recs toptable --x state --y priority
```

### Display left over field names as columns
```bash
... | recs collate --key state,priority -a count -a sum,rss | recs toptable --x state,FIELD --y priority
```

### Specify the displayed cell values
```bash
... | recs collate --key state,priority -a count -a sum,rss | recs toptable --x state,FIELD --y priority --v sum_rss
```

## See Also

- [collate](./collate)
- [totable](./totable)
