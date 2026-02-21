# The Pipeline Model

RecordStream is built on a philosophy that's older than most programming languages: **the Unix pipeline**.

## One Record, One Line

The fundamental data format is dead simple: each line of input/output is a single JSON object. That's it. That's the whole protocol.

```
{"name":"Alice","age":30,"dept":"Engineering"}
{"name":"Bob","age":25,"dept":"Marketing"}
{"name":"Charlie","age":35,"dept":"Engineering"}
```

No framing. No headers. No envelope. Just JSON objects separated by newlines (sometimes called [JSONL](https://jsonlines.org/) or "newline-delimited JSON"). This means you can use standard Unix tools alongside recs commands — `head`, `tail`, `wc -l`, `tee`, even `grep` (though `recs grep` is usually better).

## Input, Transform, Output

Every recs command fits into one of three roles:

```
  ┌─────────┐      ┌───────────┐      ┌──────────┐
  │  Input   │─────▶│ Transform │─────▶│  Output  │
  │ from*    │      │ grep/sort │      │  to*     │
  └─────────┘      │ collate.. │      └──────────┘
                    └───────────┘
```

**Input** commands (`from*`) create records from external data — CSV files, databases, XML, regex matches, and more. They write JSON records to stdout.

**Transform** commands reshape the stream — filtering (`grep`), modifying (`xform`), sorting (`sort`), aggregating (`collate`), and more. They read records from stdin and write records to stdout.

**Output** commands (`to*`) consume records and produce human-readable output — tables, CSV, HTML, pretty-printed JSON. They read from stdin and write formatted text to stdout.

## Streaming vs. Buffering

Most recs commands are **streaming** — they process one record at a time and output immediately. This means they work on arbitrarily large datasets without eating your RAM:

- `grep` — streaming (each record is independent)
- `xform` — streaming
- `eval` — streaming
- `annotate` — streaming

Some commands need to see the entire stream before producing output. These are **buffering** commands:

- `sort` — must see all records to sort them
- `collate` — must see all records in each group
- `totable` — must see all records to calculate column widths
- `topn` — must see all records to find the top N

When building pipelines, put streaming operations early to reduce the data that buffering operations need to hold.

## Composability

Because every command speaks the same protocol (JSON lines in, JSON lines out), you can combine them freely:

```bash
# This works because each | connects stdout to stdin
recs fromcsv --header data.csv \
  | recs grep '{{status}} !== "inactive"' \
  | recs xform '{{full_name}} = {{first}} + " " + {{last}}' \
  | recs sort --key full_name \
  | recs totable -k full_name,status
```

You can also mix recs with other Unix tools:

```bash
# Count records with standard wc
recs fromcsv --header data.csv | recs grep '{{active}}' | wc -l

# Save intermediate results with tee
recs fromcsv --header data.csv \
  | tee raw-records.jsonl \
  | recs collate -a count \
  | recs eval '"Total records: {{count}}"'

# Use standard grep for quick filtering (works on the JSON text)
recs fromcsv --header data.csv | grep '"error"' | recs totable
```

## Debugging Pipelines

One of the best things about the pipeline model is debuggability. You can always slice a pipeline at any `|` and inspect what's flowing through:

```bash
# See what's happening after the grep
recs fromcsv --header data.csv \
  | recs grep '{{status}} >= 500' \
  | recs toprettyprint

# Or just look at the first few records
recs fromcsv --header data.csv \
  | recs grep '{{status}} >= 500' \
  | head -5
```

No print statements. No debugger. Just pipes.
