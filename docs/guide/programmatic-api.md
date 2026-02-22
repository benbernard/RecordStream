# Programmatic API

RecordStream isn't just a command-line tool — it's also a TypeScript library with a fluent, chainable API. Build data pipelines in code with the same power as the CLI.

## Quick Start

```typescript
import { RecordStream } from "recs";

const results = await RecordStream.fromJsonLines(`
  {"name":"Alice","age":30,"dept":"Engineering"}
  {"name":"Bob","age":25,"dept":"Marketing"}
  {"name":"Charlie","age":35,"dept":"Engineering"}
`)
  .grep('{{dept}} === "Engineering"')
  .sort("age")
  .toJsonArray();

// [{ name: "Alice", age: 30, ... }, { name: "Charlie", age: 35, ... }]
```

## Creating Streams

### From JSON Lines

The most common format — one JSON object per line:

```typescript
// From a string
const stream = RecordStream.fromJsonLines(jsonlString);

// From a ReadableStream (e.g., fetch response body)
const response = await fetch("https://api.example.com/data.jsonl");
const stream = RecordStream.fromJsonLines(response.body);
```

### From JSON Arrays

```typescript
// From a string
const stream = RecordStream.fromJsonArray('[{"a":1},{"a":2}]');

// From an array of objects
const stream = RecordStream.fromJsonArray([
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
]);
```

### From CSV

```typescript
const stream = RecordStream.fromCsv(`name,age,dept
Alice,30,Engineering
Bob,25,Marketing`);
```

### From Records

```typescript
import { Record } from "recs";

const records = [
  new Record({ name: "Alice", age: 30 }),
  new Record({ name: "Bob", age: 25 }),
];

const stream = RecordStream.fromRecords(records);
```

### From Async Iterables

```typescript
async function* generateRecords() {
  for (let i = 0; i < 1000; i++) {
    yield new Record({ index: i, value: Math.random() });
  }
}

const stream = RecordStream.fromAsyncIterable(generateRecords());
```

## Transform Methods

All transform methods return a new `RecordStream`, so you can chain them:

### `grep(predicate)`

Filter records. Accepts a snippet string or a function:

```typescript
// Snippet (uses {{keyspec}} syntax)
stream.grep('{{age}} > 21')

// Function
stream.grep(r => r.get("age") > 21)
```

### `eval(snippet)`

Modify records in place with a snippet:

```typescript
stream.eval('{{full_name}} = {{first}} + " " + {{last}}')
```

### `xform(snippetOrFn)`

Transform records, optionally producing multiple outputs:

```typescript
// Snippet
stream.xform('{{age}} = {{age}} + 1')

// Function returning array of records
stream.xform(r => {
  const tags = r.get("tags") as string[];
  return tags.map(tag => {
    const clone = r.clone();
    clone.set("tag", tag);
    return clone;
  });
})
```

### `sort(...keys)`

Sort by key specs. Prefix with `-` for descending, suffix with `=n` for numeric:

```typescript
stream.sort("name")           // ascending lexical
stream.sort("age=n")          // ascending numeric
stream.sort("age=-n")         // descending numeric
stream.sort("dept", "name")   // multi-key sort
```

### `head(n)` / `tail(n)`

Take or skip records:

```typescript
stream.head(10)   // first 10 records
stream.tail(5)    // skip first 5 records
```

### `uniq(...keys)`

Deduplicate (records must be pre-sorted by the given keys):

```typescript
stream.sort("email").uniq("email")
```

### `collate(options)`

Group and aggregate:

```typescript
import { aggregatorRegistry } from "recs";

stream.collate({
  keys: ["department"],
  aggregators: new Map([
    ["count", aggregatorRegistry.make("count", [])],
    ["avg_salary", aggregatorRegistry.make("average", ["salary"])],
  ]),
})
```

### `decollate(field)`

Expand an array field into separate records:

```typescript
// Input:  { name: "Alice", tags: ["admin", "user"] }
// Output: { name: "Alice", tags: "admin" }
//         { name: "Alice", tags: "user" }
stream.decollate("tags")
```

### `map(fn)` / `reverse()` / `concat(other)`

```typescript
stream.map(r => { r.set("processed", true); return r; })
stream.reverse()
stream.concat(otherStream)
```

## Terminal Operations

These consume the stream and return a result:

```typescript
const records = await stream.toArray();       // Record[]
const objects = await stream.toJsonArray();   // JsonObject[]
const jsonl = await stream.toJsonLines();     // string (JSONL)
const csv = await stream.toCsv();             // string (CSV)
```

### Async Iteration

`RecordStream` implements `AsyncIterable`, so you can use `for await`:

```typescript
for await (const record of stream) {
  console.log(record.get("name"));
}
```

## The Record Class

The `Record` class wraps a JSON object with convenient accessors:

```typescript
import { Record } from "recs";

const r = new Record({ name: "Alice", age: 30 });

r.get("name");           // "Alice"
r.set("age", 31);        // modifies in place
r.keys();                // ["name", "age"]
r.toJSON();              // { name: "Alice", age: 31 }
r.toString();            // '{"name":"Alice","age":31}'
r.clone();               // deep copy

// Key spec access for nested data
r.set("address/city", "Seattle");  // creates nested structure
r.get("address/city");             // "Seattle"
```

## Putting It All Together

```typescript
import { RecordStream } from "recs";

// Analyze API response data
const response = await fetch("https://api.example.com/users");
const users = await response.json();

const report = await RecordStream.fromJsonArray(users)
  .grep('{{active}} === true')
  .eval('{{tenure_years}} = (Date.now() - new Date({{created_at}}).getTime()) / 31536000000')
  .sort("tenure_years=-n")
  .head(20)
  .toJsonArray();

console.log("Top 20 longest-tenured active users:", report);
```
