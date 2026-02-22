# eval

Evaluate a snippet on each record and output the result as a plain text line.

## Synopsis

```bash
recs eval [options] <expression> [files...]
```

## Description

The `eval` command is the escape hatch from the record world. It evaluates a JavaScript expression on each record and prints the result as a plain text line -- not a JSON record, just raw text. This makes it the bridge between RecordStream and the rest of the Unix universe.

Use `eval` when you need to extract values for scripts, prepare data for tools that expect plain text input, or generate commands to pipe into `sh`. It is the last step when your pipeline needs to produce something other than records.

Note that `eval` does NOT output records. It outputs raw strings. This means you generally cannot pipe its output into another recs command (unless that command reads from text, like `fromre`). If you want to modify records and keep them as records, use `xform` instead.

## Options

| Flag | Description |
|------|-------------|
| `--chomp` | Remove trailing newlines from eval results. Useful when your expression already includes a newline and you want to avoid double-spacing. |

The expression is provided as a positional argument. Inside the snippet, `r` is the current record object.

## Examples

### Print a single field from each record
```bash
recs eval 'r.host'
```

### Prepare x/y data for gnuplot
```bash
recs eval 'r.x + " " + r.y'
```

### Generate shell commands from records
```bash
recs eval '"./deploy.sh --server " + r.hostname + " --version " + r.version' | sh
```

### Format a human-readable summary line
```bash
recs eval '`${r.name}: ${r.score} points (${r.rank})`'
```

### Extract and chomp values that may have trailing newlines
```bash
recs eval --chomp 'r.message'
```

## See Also

- [xform](./xform) - Transform records while keeping them as records
- [toprettyprint](./toprettyprint) - Pretty-print records as formatted output
- [totable](./totable) - Output records as a formatted table
