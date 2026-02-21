# fromps

Capture the current system process table as records.

## Synopsis

```bash
recs fromps [options]
```

## Description

`fromps` reads the system process table and emits one record per process. It is the recs equivalent of running `ps aux` -- except the output is structured JSON you can filter, sort, and aggregate with the rest of the recs toolkit.

Under the hood, the command runs `ps aux` and parses the output, using the header line to determine field names. All field names are lowercased for consistency. On most systems you will get fields like `user`, `pid`, `%cpu`, `%mem`, `vsz`, `rss`, `tty`, `stat`, `start`, `time`, and `command`.

By default, all available fields are included. If you only need a few, use `--key` to select them. This does not make the command faster (the full process table is still read), but it produces leaner output records.

## Options

| Flag | Description |
|------|-------------|
| `--key <fields>` / `-k <fields>` | Comma-separated list of fields to include in the output. May be specified multiple times. Defaults to all fields. |
| `--field <fields>` / `-f <fields>` | Alias for `--key`. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename. |

## Typical Fields

The exact fields depend on your OS and `ps` implementation. Common fields from `ps aux`:

| Field | Description |
|-------|-------------|
| `user` | Process owner |
| `pid` | Process ID |
| `%cpu` | CPU usage percentage |
| `%mem` | Memory usage percentage |
| `vsz` | Virtual memory size (KB) |
| `rss` | Resident set size (KB) |
| `tty` | Controlling terminal |
| `stat` | Process state |
| `start` | Start time |
| `time` | Cumulative CPU time |
| `command` | Full command line |

## Examples

### List all processes
```bash
recs fromps
```

### Find the top 10 CPU consumers
```bash
recs fromps \
  | recs sort --key '%cpu=-n' \
  | recs topn --n 10 \
  | recs totable --key user,pid,%cpu,command
```

### Find all processes owned by a specific user
```bash
recs fromps | recs grep '{{user}} eq "www-data"'
```

### Count processes per user
```bash
recs fromps \
  | recs collate --key user --aggregator count \
  | recs sort --key count=-n
```

### Get only PID and command for processes using more than 1% memory
```bash
recs fromps --key pid,command,%mem \
  | recs grep '{{%mem}} > 1.0'
```

### Total memory usage by user
```bash
recs fromps \
  | recs collate --key user --aggregator 'sum(%mem)' \
  | recs sort --key 'sum_%mem=-n'
```

## Notes

- This command takes no input from stdin; it reads directly from the system process table.
- The process snapshot is taken at the moment the command runs. For continuous monitoring, run it in a loop or use a dedicated monitoring tool.
- Field names come directly from the `ps` header line and are lowercased. The exact set varies by operating system.

## See Also

- [fromre](./fromre) - For parsing other command output via regex
- [fromcsv](./fromcsv) - For parsing tabular command output with consistent delimiters
