# Key Specs

Key Specs are how you tell recs which field you're talking about. They're like a GPS for your data — point at any value in a record, no matter how deeply nested.

## Basic Access

The simplest key spec is just a field name:

```bash
recs grep '{{name}} === "Alice"'
```

This accesses the `name` field at the top level of the record.

## Nested Access with `/`

Use `/` to navigate into nested objects:

```bash
# Record: {"user": {"profile": {"email": "alice@example.com"}}}
recs grep '{{user/profile/email}}.includes("@example.com")'
```

Each `/` descends one level into the data structure. The key spec `user/profile/email` means "look up `user`, then inside that look up `profile`, then inside that look up `email`".

## Array Indexing with `#`

Use `#N` to index into arrays (zero-based):

```bash
# Record: {"scores": [95, 87, 92]}
recs eval '{{scores/#0}}'    # 95
recs eval '{{scores/#2}}'    # 92
```

You can combine array indexing with nested access:

```bash
# Record: {"users": [{"name": "Alice"}, {"name": "Bob"}]}
recs eval '{{users/#0/name}}'    # Alice
```

## Fuzzy Matching with `@`

Prefix a key spec with `@` to enable fuzzy matching. This is a lifesaver when your field names are long or you can't quite remember the exact spelling:

```bash
# Record: {"http_response_code": 200, "http_method": "GET"}
recs eval '{{@http_resp}}'    # 200 (prefix match)
```

Fuzzy matching works in this priority order:

1. **Exact match** — if the key exists exactly as specified, use it
2. **Prefix match** — if a key starts with the spec (case-insensitive), use it
3. **Substring match** — if a key contains the spec anywhere (case-insensitive), use it

```bash
# Record: {"zip": 1, "zap": 2, "foo": {"bar": 3}}

# @z  → matches "zap" (last prefix match wins in sorted order)
# @zi → matches "zip" (exact prefix)
# @f  → matches "foo"
```

## Escaping `/` in Key Names

If your field name literally contains a `/`, escape it with `\`:

```bash
# Record: {"content/type": "application/json"}
recs eval '{{content\/type}}'    # application/json
```

## Setting Values

When used in `xform` snippets, key specs on the left side of `=` set values. Intermediate objects are created automatically:

```bash
# Creates the nested structure if it doesn't exist
recs xform '{{stats/average}} = {{total}} / {{count}}'

# Before: {"total": 100, "count": 4}
# After:  {"total": 100, "count": 4, "stats": {"average": 25}}
```

If an intermediate path element starts with `#`, an array is created instead of an object.

## Summary

| Syntax | Meaning | Example |
|--------|---------|---------|
| `name` | Top-level field | `{{name}}` |
| `a/b/c` | Nested access | `{{user/profile/email}}` |
| `a/#0` | Array index | `{{scores/#0}}` |
| `@prefix` | Fuzzy match | `{{@http_resp}}` |
| `a\/b` | Escaped slash | `{{content\/type}}` |

Key specs are used everywhere in recs — in `--key` arguments, in snippet `{{}}` expressions, and in aggregator field references. Master them and you can point at any piece of data in any record.
