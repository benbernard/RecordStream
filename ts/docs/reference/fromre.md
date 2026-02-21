# fromre

Parse lines using a single regex, with capture groups becoming record fields.

## Synopsis

```bash
recs fromre [options] <regex> [files...]
```

## Description

`fromre` is the general-purpose regex parser. It applies a regular expression to each line of input, and for every line that matches, it emits a record whose fields are the capture groups from the match. Lines that do not match are silently ignored -- no error, no warning, just skipped.

Field names default to numeric indices (0, 1, 2, ...) corresponding to the capture groups. You can assign meaningful names with `--key`. If you provide fewer key names than capture groups, the remaining groups get numeric names. If you provide more key names than groups, the extras are ignored.

This command is the right choice when each line of input corresponds to exactly one record and the structure within a line can be described by a regex. For multi-line records where fields are spread across several lines, see `frommultire`. For simple delimiter-based splitting, see `fromsplit`.

## Options

| Flag | Description |
|------|-------------|
| `--key <keys>` / `-k <keys>` | Comma-separated list of field names for the capture groups. May be specified multiple times. Supports key specs. |
| `--field <keys>` / `-f <keys>` | Alias for `--key`. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename. |

The `<regex>` argument is required and must be the first positional argument.

## Examples

### Parse a greeting with named fields
```bash
echo 'Hello, my name is Alice and I am 30 years old' \
  | recs fromre --key name,age '^Hello, my name is (.*) and I am (\d+) years? old$'
```
Output: `{"name":"Alice","age":"30"}`

### Extract timestamps from log lines
```bash
recs fromre --key time '^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})' < app.log
```

### Parse angle-bracket delimited fields with numeric keys
```bash
echo '<foo> <bar> <baz>' \
  | recs fromre '<(.*)>\s*<(.*)>\s*<(.*)>'
```
Output: `{"0":"foo","1":"bar","2":"baz"}`

### Extract user and PID from syslog lines
```bash
recs fromre --key user,pid 'session opened for user (\w+)\(uid=\d+\) by .* pid=(\d+)' \
  < /var/log/auth.log
```

### Parse key=value pairs from a log line
```bash
recs fromre --key key,value '(\w+)=(\S+)' < events.log
```

### Process multiple files and track the source
```bash
recs fromre --key level,msg --fk source '^\[(\w+)\] (.*)$' logs/*.txt
```

## Notes

- The regex is compiled as a JavaScript `RegExp`. Standard regex syntax applies (not Perl-specific extensions like `(?{code})`).
- Only lines that match produce output. Non-matching lines are discarded without error.
- Capture group numbering starts at 1 in the regex, but field naming starts at 0. The first capture group `(...)` maps to key index 0.

## See Also

- [frommultire](./frommultire) - For matching multiple patterns, especially across multi-line records
- [fromsplit](./fromsplit) - For simple delimiter-based splitting (no regex capture groups needed)
- [fromcsv](./fromcsv) - For well-formed CSV/TSV data
