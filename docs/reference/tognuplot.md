# tognuplot

Create a graph of points from a record stream using GNU Plot.

## Synopsis

```bash
recs tognuplot [options] [files...]
```

## Description

Create a graph of points from a record stream using GNU Plot. Defaults to creating a scatterplot of points, can also create a bar or line graph.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` / `--fields` / `-f` `<keys>` | Keys to graph. May be specified multiple times or comma separated. If you have more than 2 keys, you must specify a --using statement or use --bargraph or --lines. **(required)** |
| `--using` `<using spec>` | A 'using' string passed directly to gnuplot. You can reference keys specified with --key in the order specified. May be specified multiple times. |
| `--plot` `<plot spec>` | A directive passed directly to plot, e.g. --plot '5 title "threshold"'. May be specified multiple times or comma separated. |
| `--precommand` `<gnuplot spec>` | A command executed by gnuplot before executing plot, e.g. --precommand 'set xlabel "foo"'. May be specified multiple times or comma separated. |
| `--title` `<title>` | Specify a title for the entire graph. |
| `--label` `<label>` | Labels each --using line with the indicated label. |
| `--file` `<filename>` | Name of output png file. Will append .png if not present. Defaults to tognuplot.png. |
| `--lines` | Draw lines between points. May specify more than 2 keys, each field is a line. |
| `--bargraph` | Draw a bar graph. May specify more than 2 keys, each field is a bar. |
| `--gnuplot-command` `<path>` | Location of gnuplot binary if not on path. |
| `--dump-to-screen` | Instead of making a graph, dump the generated gnuplot script to STDOUT. |

## Examples

### Graph the count field
```bash
recs tognuplot --field count
```

### Graph count vs. date with a threshold line
```bash
recs tognuplot --field count,date --plot "5 title 'threshold'"
```

### Graph a complicated expression, with a label
```bash
recs tognuplot --field count,date,adjust --using '($1-$3):2' --label counts
```

### Graph count vs. date, with a title
```bash
recs tognuplot --field count,date --title 'counts over time'
```

## See Also

- [togdgraph](./togdgraph)
