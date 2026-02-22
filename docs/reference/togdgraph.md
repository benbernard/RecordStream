# togdgraph

Create a bar, scatter, or line graph.

## Synopsis

```bash
recs togdgraph [options] [files...]
```

## Description

Create a bar, scatter, or line graph. Generates an image file from the record stream.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` / `--fields` / `-f` `<keyspec>` | Specify keys that correlate to keys in JSON data. |
| `--option` / `-o` `<option=val>` | Specify custom options for the graph. |
| `--label-x` `<val>` | Specify X-axis label. |
| `--label-y` `<val>` | Specify Y-axis label. |
| `--graph-title` `<val>` | Specify graph title. |
| `--png-file` `<val>` | Specify output PNG filename (default: togdgraph.png). |
| `--type` `<val>` | Specify graph type: scatter (default), line, or bar. |
| `--width` `<val>` | Specify graph width (default: 600). |
| `--height` `<val>` | Specify graph height (default: 300). |
| `--dump-use-spec` | Dump usage spec (used mainly for testing). |

## Examples

### Create a scatter plot of uid vs ct
```bash
recs togdgraph --key uid,ct --png-file login-graph.png --graph-title '# of logins' --label-x user --label-y logins
```

### Create a line graph
```bash
recs togdgraph --key uid,ct --type line
```

### Customize with additional graph options
```bash
recs togdgraph --key uid,ct --option boxclr=pink --label-y logins --label-x user --option labelclr=yellow
```

## See Also

- [tognuplot](./tognuplot)
