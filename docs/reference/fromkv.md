# fromkv

Records are generated from character input with the form "&lt;record&gt;&lt;record-delim&gt;&lt;record&gt;...".

## Synopsis

```bash
recs fromkv [options] [<files>]
```

## Description

Records are generated from character input with the form "&lt;record&gt;&lt;record-delim&gt;&lt;record&gt;...". Records have the form "&lt;entry&gt;&lt;entry-delim&gt;&lt;entry&gt;...". Entries are pairs of the form "&lt;key&gt;&lt;kv-delim&gt;&lt;value&gt;".

## Options

| Flag | Description |
|------|-------------|
| `--kv-delim` / `-f` `<delim>` | Delimiter for separating key/value pairs within an entry (default ' '). |
| `--entry-delim` / `-e` `<delim>` | Delimiter for separating entries within records (default '\n'). |
| `--record-delim` / `-r` `<delim>` | Delimiter for separating records (default 'END\n'). |

## Examples

### Parse memcached stat metrics into records
```bash
echo -ne 'stats\r\n' | nc -i1 localhost 11211 | tr -d '\r' | awk '{if (! /END/) {print $2" "$3} else {print $0}}' | recs fromkv
```

### Parse records separated by 'E\n' with entries separated by '|' and pairs separated by '='
```bash
recs fromkv --kv-delim '=' --entry-delim '|' --record-delim $(echo -ne 'E\n')
```
