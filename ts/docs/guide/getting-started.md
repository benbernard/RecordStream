# Getting Started

Five minutes. That's all it takes to go from "what is this?" to "how did I live without this?"

## Installation

```bash
# Homebrew (macOS / Linux)
brew install recs

# Or download a prebuilt binary
curl -fsSL https://github.com/benbernard/RecordStream/releases/latest/download/recs-$(uname -s)-$(uname -m) -o recs
chmod +x recs && sudo mv recs /usr/local/bin/

# Or install from npm
npm install -g recs
```

Verify it works:

```bash
echo '{"name":"world"}' | recs eval '"Hello, {{name}}!"'
# Hello, world!
```

If you see that, you're in business.

## Your First Pipeline

RecordStream works with **records** — JSON objects, one per line. Let's start with the simplest possible pipeline:

```bash
echo '{"greeting":"hello","target":"world"}' | recs eval '"{{greeting}}, {{target}}!"'
```

Output:
```
hello, world!
```

The `{{greeting}}` syntax is a **key spec** — it reaches into the record and grabs the value. More on that in the [Key Specs guide](/guide/key-specs).

## A Real-World Example

Say you've got a CSV of server logs:

```csv
timestamp,host,status,latency_ms
2024-01-15T10:00:00Z,web-1,200,45
2024-01-15T10:00:01Z,web-2,500,2301
2024-01-15T10:00:02Z,web-1,200,52
2024-01-15T10:00:03Z,web-3,200,38
2024-01-15T10:00:04Z,web-2,500,3102
```

**Before recs:** You'd write a Python script, import csv, loop through rows, build dictionaries, filter, aggregate... 20 lines minimum.

**After recs:**

```bash
# Which hosts are having a bad day?
recs fromcsv --header logs.csv       \
  | recs grep '{{status}} >= 500'    \
  | recs collate --key host -a count \
  | recs sort --key count=-n         \
  | recs totable
```

```
host    count
----    -----
web-2   2
```

Web-2 is the culprit. Case closed.

## The Three Flavors of Commands

Every recs command falls into one of three categories:

### Input: Getting Data In

These commands create records from external sources:

```bash
recs fromcsv --header data.csv         # CSV files
recs fromjsonarray < data.json         # JSON arrays
recs fromkv --delim '=' < config.txt   # Key-value pairs
recs fromre '(\d+)\s+(\w+)' -k num,word < data.txt  # Regex extraction
```

### Transform: Doing Stuff With It

These commands reshape, filter, and aggregate:

```bash
recs grep '{{age}} > 21'                      # Filter records
recs xform '{{name}} = {{name}}.toUpperCase()' # Modify in place
recs sort --key age=-n                         # Sort (numeric, descending)
recs collate --key dept -a sum,salary          # Group and aggregate
```

### Output: Getting Data Out

These commands render records for human consumption:

```bash
recs totable                      # ASCII table
recs tocsv -k name,age            # Back to CSV
recs toprettyprint                # Pretty-printed JSON
recs tohtml                       # HTML table
```

## Composing Commands

The power is in the pipes. Each command does one thing well, and you chain them together:

```bash
recs fromcsv --header employees.csv   \
  | recs grep '{{department}} === "Engineering"' \
  | recs xform '{{annual}} = {{salary}} * 12'    \
  | recs sort --key annual=-n                     \
  | recs topn --key annual -n 5                   \
  | recs totable -k name,annual
```

That pipeline:
1. Reads a CSV with headers
2. Keeps only Engineering records
3. Computes annual salary
4. Sorts by salary descending
5. Takes the top 5
6. Displays as a table

All without writing a single script file. Your data just got piped into shape.

## Next Steps

- **[Snippets](/guide/snippets)** — Learn the `{{keyspec}}` syntax and inline code expressions
- **[Key Specs](/guide/key-specs)** — Navigate nested data like a pro
- **[The Pipeline Model](/guide/pipeline)** — Understand the philosophy
- **[Command Reference](/reference/)** — Every command, every flag, every example
