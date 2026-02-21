# Key Groups

Key Groups let you specify multiple fields at once using regex patterns. Instead of listing every field by name, you describe a *pattern* and recs figures out which fields match.

## Why Key Groups?

Imagine you have records with dozens of fields and you only want to display the ones starting with `http_`:

```bash
# Without key groups: tedious
recs totable -k http_status -k http_method -k http_url -k http_latency

# With key groups: elegant
recs totable -k '!http_!'
```

## Syntax

A key group is enclosed in `!` delimiters:

```
!regex!option1!option2...
```

The regex is matched against field names to determine which fields to include.

## Basic Examples

```bash
# Match all fields starting with "http"
recs totable -k '!^http!'

# Match all fields containing "time"
recs totable -k '!time!'

# Match all fields (everything matches ".")
recs totable -k '!.!'

# Match fields that are just digits
recs totable -k '!^\d+$!'
```

Given a record like:
```json
{"zip": 1, "zap": 2, "foo": {"bar": 3}}
```

- `!z!` matches `zip` and `zap`
- `!^z!` matches `zip` and `zap`
- `!^f!` matches `foo` — but only if `returnrefs` is enabled (see below)

## Options

Options are appended after the closing `!`:

| Option | Short | Description |
|--------|-------|-------------|
| `returnrefs` | `rr` | Include fields whose values are objects/arrays (default: only scalars) |
| `full` | `f` | Match regex against full key paths (recurse into nested objects) |
| `depth=N` | `d=N` | Only match keys at depth N (regex matches against full keyspec) |
| `sort` | `s` | Sort matched keyspecs lexically |

### `returnrefs` / `rr`

By default, key groups only match fields with scalar values (strings, numbers, booleans). To include fields with object or array values, use `rr`:

```bash
# Record: {"name": "Alice", "scores": [95, 87], "meta": {"id": 1}}

# Only matches "name" (scalar)
recs totable -k '!.!'

# Matches "name", "scores", and "meta"
recs totable -k '!.!rr'
```

### `full` / `f`

Normally, the regex is matched only against top-level field names. With `full`, the regex matches against the full keyspec path, recursing into nested objects:

```bash
# Record: {"user": {"name": "Alice", "email": "alice@example.com"}}

# Matches nothing (no top-level "name" field)
recs totable -k '!name!'

# Matches "user/name" (full path matching)
recs totable -k '!name!f'
```

### `depth=N` / `d=N`

Match only fields at a specific nesting depth:

```bash
# Record: {"a": {"b": {"c": 1, "d": 2}, "e": 3}}

# Match fields at depth 2 (a/b, a/e)
recs totable -k '!.!d=2'

# Match fields at depth 3 (a/b/c, a/b/d)
recs totable -k '!.!d=3'
```

### `sort` / `s`

Sort the matched keyspecs lexically. Useful for consistent column ordering:

```bash
recs totable -k '!.!s'
```

## Combining with Regular Key Specs

You can mix key groups and regular key specs in the same command:

```bash
# Show "name" first, then all fields matching "score"
recs totable -k name -k '!score!'
```

## Escaping `!` in Regex

If you need a literal `!` in your regex, escape it with `\`:

```bash
recs totable -k '!field\!name!'
```

## Real-World Examples

### Display all timing-related fields

```bash
recs fromjsonarray < metrics.json \
  | recs totable -k '!time|latency|duration!s'
```

### Summarize all numeric fields

```bash
recs fromcsv --header data.csv \
  | recs collate -a 'sum,!^\d|amount|count!s'
```

### Show deeply nested fields

```bash
recs fromxml config.xml \
  | recs totable -k '!.!f!s'
```
