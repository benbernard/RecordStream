# tognuplot

Create a graph from a record stream using gnuplot.

## Synopsis

```bash
recs tognuplot [options] [files...]
```

## Description

The `tognuplot` command marshals your record stream into a data file, generates a gnuplot script, and invokes gnuplot to produce a PNG image. It defaults to a scatter plot but supports line graphs (`--lines`) and bar charts (`--bargraph`). For two fields, it just works. For more than two fields with `--lines` or `--bargraph`, each extra field becomes its own series. If you have more than two fields in scatter mode, you will need to provide a `--using` specification to tell gnuplot how to interpret the columns.

The `--using` and `--plot` flags pass directives directly to gnuplot, so you have the full power of gnuplot's plotting language at your disposal. Fields specified with `--key` are written as numbered columns in the data file: `$1` is the first key, `$2` the second, and so on. You can write expressions like `--using '($1-$3):2'` to plot computed values.

For pre-plot configuration (axis labels, ranges, styles, etc.), use `--precommand` to inject arbitrary gnuplot commands. The `--dump-to-screen` flag prints the generated gnuplot script and data to stdout instead of running gnuplot, which is invaluable for debugging or for piping into gnuplot manually.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | Keys to graph. May be comma-separated or specified multiple times. With `--lines` or `--bargraph`, each key beyond the first becomes a separate series. |
| `--fields` / `-f` | Alias for `--key`. |
| `--using` | A gnuplot `using` specification. May be specified multiple times for multiple plot series. Column numbers correspond to `--key` order. |
| `--plot` | A directive passed directly to the gnuplot `plot` command (e.g., `'5 title "threshold"'`). May be specified multiple times. |
| `--precommand` | A gnuplot command executed before the `plot` command (e.g., `'set xlabel "foo"'`). May be specified multiple times. |
| `--title` | Title for the entire graph. Defaults to a comma-separated list of field names. |
| `--label` | Label for each `--using` line. Specified in order matching the `--using` flags. |
| `--file` | Output PNG filename (default: `tognuplot.png`). Appends `.png` if not already present. |
| `--lines` | Draw lines between points. Allows more than 2 keys; each field becomes a line. |
| `--bargraph` | Draw a bar graph. Allows more than 2 keys; each field becomes a bar series. |
| `--gnuplot-command` | Path to the gnuplot binary if it is not on your `PATH`. |
| `--dump-to-screen` | Print the gnuplot script and data to stdout instead of generating a graph. |
| `--filename-key` / `--fk` | Add a key with the source filename (puts `NONE` if not applicable). |

## Examples

### Simple scatter plot of one field
```bash
cat data.jsonl | recs tognuplot --key count
```
Plots the `count` field against its record index.

### Two-field scatter plot with threshold line
```bash
cat data.jsonl | recs tognuplot --key count,date --plot "5 title 'threshold'"
```
Plots `count` vs `date` with a horizontal line at y=5.

### Computed expression with label
```bash
cat data.jsonl | recs tognuplot --key count,date,adjust --using '($1-$3):2' --label "adjusted counts"
```
Subtracts `adjust` from `count` and plots the result against `date`.

### Line graph with title
```bash
cat data.jsonl | recs tognuplot --key count,date --lines --title 'Counts Over Time'
```
Connects the dots. Literally.

### Multi-series bar chart
```bash
cat data.jsonl | recs tognuplot --key count1,count2,count3 --bargraph
```
Each of the three count fields becomes its own bar series.

### Debug the generated script
```bash
cat data.jsonl | recs tognuplot --key x,y --dump-to-screen
```
Prints the gnuplot script and data points to stdout instead of invoking gnuplot. Useful for tweaking before committing to PNG.

### Custom gnuplot configuration
```bash
cat data.jsonl | recs tognuplot --key time,latency \
  --precommand 'set xlabel "Time (s)"' \
  --precommand 'set ylabel "Latency (ms)"' \
  --precommand 'set grid' \
  --file latency-chart
```
Sets axis labels and enables grid lines before plotting. The `.png` extension is appended automatically.

## See Also

- [togdgraph](./togdgraph) - Generate graphs with a built-in SVG renderer (no gnuplot required)
- [tocsv](./tocsv) - Export as CSV for graphing in external tools
