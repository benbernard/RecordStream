# eval

Evaluate an expression on each record and print the result as a line of text.

## Synopsis

```bash
recs eval [options] <expression> [files...]
```

## Description

Evaluate an expression on each record and print the result as a line of text. This is NOT a record stream output -- it prints raw text lines. The expression is evaluated with r set to the current Record object and line set to the current line number (starting at 1). When --lang is used with a non-JS language, the record is modified by the snippet and output as a JSON line.

## Options

| Flag | Description |
|------|-------------|
| `--chomp` | Chomp eval results (remove trailing newlines to avoid duplicate newlines when already newline-terminated). |
| `--lang` / `-l` `<lang>` | Snippet language: js (default), python/py, perl/pl. |

## Examples

### Print the host field from each record
```bash
recs eval 'r.host'
```

### Prepare to gnuplot field y against field x
```bash
recs eval 'r.x + " " + r.y'
```

### Add a field using Python
```bash
recs eval --lang python 'r["b"] = r["a"] + 1'
```

## See Also

- [xform](./xform)
- [grep](./grep)
