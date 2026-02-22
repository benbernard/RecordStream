# fromkv

Parse key-value pair text into records.

## Synopsis

```bash
recs fromkv [options] [files...]
```

## Description

`fromkv` converts text with a key-value pair structure into records. It is designed for the kind of output you get from tools like `memcached stats`, `sysctl`, or any program that dumps data in a `key value` format separated by newlines, with records delimited by a sentinel line.

The parsing is controlled by three delimiters. The **record delimiter** separates one record from the next (default: `END\n`). The **entry delimiter** separates individual key-value pairs within a record (default: `\n`). The **key-value delimiter** separates the key from the value within a pair (default: a single space). All three are configurable, which makes this command surprisingly versatile for parsing semi-structured text output from legacy tools.

Each key-value pair becomes a field in the output record. If the input does not end with the record delimiter, the final accumulation of key-value pairs is still flushed as a record at end-of-input.

## Options

| Flag | Description |
|------|-------------|
| `--kv-delim <delim>` / `-f <delim>` | Delimiter between key and value within an entry. Default is a single space `" "`. |
| `--entry-delim <delim>` / `-e <delim>` | Delimiter between entries within a record. Default is `"\n"` (newline). |
| `--record-delim <delim>` / `-r <delim>` | Delimiter between records. Default is `"END\n"`. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename. |

## Examples

### Parse memcached stats output
```bash
echo -ne 'stats\r\n' | nc -i1 localhost 11211 \
  | tr -d "\r" \
  | awk '{if (! /END/) {print $2" "$3} else {print $0}}' \
  | recs fromkv
```

### Parse key=value pairs separated by pipes, records by percent signs
```bash
echo 'name=Alice|age=30%name=Bob|age=25' \
  | recs fromkv --kv-delim '=' --entry-delim '|' --record-delim '%'
```

### Parse colon-separated key-value pairs
```bash
recs fromkv --kv-delim ':' < config_dump.txt
```

### Parse records separated by blank lines with = delimiters
```bash
recs fromkv --kv-delim '=' --record-delim $'\n\n' < multi_record.txt
```

### Parse sysctl-style output (key = value with spaces)
```bash
sysctl -a 2>/dev/null | recs fromkv --kv-delim ' = '
```

## Notes

- The record delimiter is matched literally, not as a regex.
- Key-value pairs that do not contain the kv-delim are silently ignored.
- Trailing whitespace in record text is trimmed before parsing entries.

## See Also

- [fromsplit](./fromsplit) - For simpler line-oriented splitting
- [fromre](./fromre) - For more flexible regex-based parsing
- [frommultire](./frommultire) - For complex multi-line log parsing
