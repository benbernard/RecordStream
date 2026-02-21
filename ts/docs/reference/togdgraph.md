# togdgraph

Create a scatter, line, or bar graph from a record stream.

## Synopsis

```bash
recs togdgraph [options] [files...]
```

## Description

The `togdgraph` command transforms your record stream into a visual graph. The original Perl version uses the GD::Graph library to generate PNG images; the TypeScript port generates SVG output instead, giving you crisp, scalable graphics without requiring native image libraries. Either way, you get a graph file on disk.

Specify the fields to plot with `--key` (or `--fields`). The first key is treated as the X axis and the second as the Y axis. By default, `togdgraph` produces a scatter plot, but you can switch to `--type line` or `--type bar` to change the visualization. Graph dimensions, axis labels, and title are all configurable.

For advanced customization, the `--option` flag lets you pass arbitrary key-value pairs to the underlying graph renderer. The Perl version passes these directly to GD::Graph options; the TypeScript version uses them as hints for the SVG renderer. The `--dump-use-spec` flag is primarily for testing, outputting the parsed configuration instead of generating a graph.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` | Specify keys for the graph axes. May be comma-separated or specified multiple times. |
| `--fields` / `-f` | Alias for `--key`. |
| `--type` | Graph type: `scatter` (default), `line`, or `bar`. |
| `--png-file` | Output filename (default: `togdgraph.png`). |
| `--graph-title` | Title displayed on the graph. |
| `--label-x` | Label for the X axis. |
| `--label-y` | Label for the Y axis. |
| `--width` | Graph width in pixels (default: `600`). |
| `--height` | Graph height in pixels (default: `300`). |
| `--option` / `-o` | Custom graph option as `key=value`. May be specified multiple times. |
| `--dump-use-spec` | Dump the graph configuration to stdout instead of generating a file (used for testing). |
| `--filename-key` / `--fk` | Add a key with the source filename (puts `NONE` if not applicable). |

## Examples

### Simple scatter plot
```bash
recs fromcsv data.csv | recs togdgraph --key x,y --png-file scatter.png
```
Plots `x` vs `y` as a scatter chart.

### Login count bar chart
```bash
recs collate --key uid -a count | recs togdgraph --key uid,count --type bar \
  --png-file logins.png --graph-title '# of logins' --label-x user --label-y logins
```
Aggregates login counts per user and renders them as a bar chart. Management loves bar charts.

### Line graph with custom dimensions
```bash
cat timeseries.jsonl | recs togdgraph --key timestamp,value --type line \
  --width 1200 --height 600 --graph-title 'Requests Over Time'
```
Creates a wide line graph suitable for dashboard display.

### Custom styling options
```bash
recs togdgraph --key uid,ct --option boxclr=pink --option labelclr=yellow \
  --label-y 'logins' --label-x 'user'
```
For when your graph needs to match the company's bold color palette. Pink background with yellow labels -- you do you.

## See Also

- [tognuplot](./tognuplot) - Generate charts using gnuplot (more plotting power, more complexity)
- [totable](./totable) - Output as an ASCII table (for when a picture is not worth a thousand words)
