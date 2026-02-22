# assert

Asserts that every record in the stream must pass the given expression.

## Synopsis

```bash
recs assert [options] <expression> [files...]
```

## Description

Asserts that every record in the stream must pass the given expression. The expression is evaluated on each record with r set to the current Record object and line set to the current line number (starting at 1). If the expression does not evaluate to true, processing is immediately aborted and an error message is printed.

## Options

| Flag | Description |
|------|-------------|
| `--diagnostic` / `-d` `<text>` | Include this diagnostic string in any failed assertion errors. |
| `--verbose` / `-v` | Verbose output for failed assertions; dumps the current record. |
| `--expr` / `-e` `<code>` | Inline expression to evaluate (alternative to positional argument). |

## Examples

### Require each record to have a date field
```bash
recs assert 'r.date'
```

### Assert all values are positive with a diagnostic
```bash
recs assert -d 'values must be positive' 'r.value > 0'
```

## See Also

- [grep](./grep)
- [xform](./xform)
