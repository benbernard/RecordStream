# fromre

The regex &lt;re&gt; is matched against each line of input (or lines of &lt;files&gt;).

## Synopsis

```bash
recs fromre [options] <re> [<files>]
```

## Description

The regex &lt;re&gt; is matched against each line of input (or lines of &lt;files&gt;). Each successful match results in one output record whose field values are the capture groups from the match. Lines that do not match are ignored. Keys are named numerically (0, 1, etc.) or as given by --key.

## Options

| Flag | Description |
|------|-------------|
| `--key` / `-k` `<keys>` | Comma separated list of key names. May be specified multiple times, may be key specs. |
| `--field` / `-f` `<keys>` | Comma separated list of key names. May be specified multiple times, may be key specs. |

## Examples

### Parse greetings
```bash
recs fromre --key name,age '^Hello, my name is (.*) and I am (\d*) years? old$'
```

### Parse a single key named time from a group of digits at the beginning of the line
```bash
recs fromre --key time '^(\d+)'
```

### Map three sets of <>s to a record with keys named 0, 1, and 2
```bash
recs fromre '<(.*)>\s*<(.*)>\s*<(.*)>'
```

## See Also

- [fromsplit](./fromsplit)
- [frommultire](./frommultire)
