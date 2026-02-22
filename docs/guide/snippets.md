# Snippets

Snippets are inline code expressions that let you reach into records and do things with them — without writing a script file, without imports, without ceremony. Just type what you mean.

## The Basics

Several recs commands accept snippet expressions: `grep`, `xform`, `eval`, `sort`, `annotate`, and more. A snippet is just a JavaScript expression that gets evaluated in the context of a record.

```bash
# Filter: keep records where age > 21
recs grep '{{age}} > 21'

# Transform: uppercase the name field
recs xform '{{name}} = {{name}}.toUpperCase()'

# Evaluate: compute a string from the record
recs eval '"Hello, {{name}}! You are {{age}} years old."'
```

## The `{{keyspec}}` Syntax

The double-brace syntax `{{keyspec}}` is the signature move of recs snippets. It's how you read (and write) record fields inside expressions.

When recs sees `{{fieldname}}`, it replaces it with the value of that field from the current record. This happens before your code runs, so you can use it anywhere a JavaScript value would go:

```bash
# These are equivalent
recs grep '{{status}} === "active"'
recs grep 'r.status === "active"'    # r is the record variable

# Nested access works too
recs grep '{{address/city}} === "Seattle"'

# Array indexing
recs grep '{{scores/#0}} > 90'
```

The `{{keyspec}}` syntax supports the full [Key Spec](/guide/key-specs) language — nested paths, array indices, fuzzy matching, everything.

## The Record Variable: `r`

Inside a snippet, the variable `r` refers to the current record (as a plain JavaScript object). You can use it directly instead of `{{}}` syntax:

```bash
# These are all equivalent
recs grep '{{name}} === "Alice"'
recs grep 'r.name === "Alice"'
recs grep 'r["name"] === "Alice"'
```

The `{{}}` syntax is usually more readable, especially for nested access:

```bash
# KeySpec nested access — clean
recs grep '{{user/profile/email}} !== undefined'

# Equivalent with r — noisier
recs grep 'r.user && r.user.profile && r.user.profile.email !== undefined'
```

## Special Variables

Inside a snippet, you have access to:

| Variable | Description |
|----------|-------------|
| `r` | The current record (plain object) |
| `$line` | The current line number (1-based) |
| `$filename` | The current input filename |

```bash
# Add a line number to each record
recs xform '{{line_num}} = $line'

# Only process the first 100 records
recs grep '$line <= 100'
```

## Writing vs. Reading

In `xform` snippets, you can *set* fields using the `{{keyspec}} = value` syntax:

```bash
# Create a new field
recs xform '{{full_name}} = {{first}} + " " + {{last}}'

# Modify an existing field
recs xform '{{price}} = Math.round({{price}} * 100) / 100'

# Set nested fields (intermediates are created automatically)
recs xform '{{stats/average}} = {{total}} / {{count}}'
```

In `grep` snippets, the expression is evaluated as a boolean — truthy means keep, falsy means discard:

```bash
recs grep '{{age}} >= 18 && {{country}} === "US"'
```

In `eval` snippets, the expression's result is printed as a string:

```bash
recs eval '`${{{name}}} earns $${{{salary}}.toLocaleString()}`'
```

## Python Snippets

If JavaScript isn't your style, you can use Python snippets with `--lang python`:

```bash
recs grep --lang python '{{age}} > 21'
recs xform --lang python '{{name}} = {{name}}.upper()'
recs eval --lang python 'f"Hello, {{{name}}}!"'
```

The same `{{keyspec}}` syntax works in Python snippets. The record variable is still `r`.

## Examples

### Log analysis: find slow requests

```bash
recs fromjsonarray < requests.json \
  | recs grep '{{latency_ms}} > 1000' \
  | recs xform '{{latency_s}} = ({{latency_ms}} / 1000).toFixed(2)' \
  | recs sort --key latency_ms=-n \
  | recs totable -k url,latency_s,status
```

### Data cleanup: normalize emails

```bash
recs fromcsv --header users.csv \
  | recs xform '{{email}} = {{email}}.toLowerCase().trim()' \
  | recs grep '{{email}}.includes("@")' \
  | recs tocsv --header -k name,email
```

### Quick calculations

```bash
recs fromcsv --header sales.csv \
  | recs xform '{{total}} = {{quantity}} * {{unit_price}}' \
  | recs collate -a 'sum,total' \
  | recs eval '"Grand total: $" + {{sum_total}}.toFixed(2)'
```
