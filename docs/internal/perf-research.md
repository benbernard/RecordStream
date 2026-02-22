# Performance Research: JSON Parsing, Serialization & Stream Processing in Bun

*Date: 2026-02-22*
*Context: RecordStream performance optimization research*

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [JSON Parsing](#json-parsing)
3. [JSON Serialization](#json-serialization)
4. [Stream Processing & Stdin Reading](#stream-processing--stdin-reading)
5. [Object Creation & GC Optimization](#object-creation--gc-optimization)
6. [String Processing](#string-processing)
7. [Bun-Specific Optimizations](#bun-specific-optimizations)
8. [Recommendations for RecordStream](#recommendations-for-recordstream)

---

## Executive Summary

RecordStream's hot path is: **stdin bytes -> TextDecoder -> line splitting -> JSON.parse -> Record wrapper -> operation pipeline -> JSON.stringify -> stdout**. After research, the key findings are:

1. **Bun's built-in `JSON.parse` is already well-optimized** - JavaScriptCore uses SIMD for JSON stringification and has a fast LiteralParser for parsing. External simdjson bindings offer marginal gains for small records (our typical use case) due to C++/JS boundary crossing overhead.

2. **The biggest wins are in I/O and buffering**, not parsing. Bun's `for await (const line of console)` and `Bun.stdin.stream()` are already fast, but we can optimize how we buffer, split lines, and write output.

3. **`fast-json-stringify` with schema gives 2-3x speedup** for serialization of small objects - directly applicable to our record output path.

4. **Object shape consistency matters enormously** for JIT optimization. Ensuring records maintain consistent shapes (hidden classes/Structures in JSC) through the pipeline is a free optimization.

5. **The clone path (`JSON.parse(JSON.stringify(data))`) is a key optimization target** - `structuredClone` or selective cloning could help.

---

## JSON Parsing

### Bun's Built-in JSON.parse (JavaScriptCore)

**Finding**: JSC's JSON.parse uses a specialized `LiteralParser` with dual-path optimization:
- Fast path for simple JSON (no reviver function)
- Separate code paths for 8-bit and 16-bit character strings
- SIMD vectorized operations for string scanning (both ARM64 NEON and x86_64 SSE)
- The SIMD is primarily used in the *stringifier* (JSON.stringify), not the parser itself

**Implication**: Bun's JSON.parse is already faster than V8's for many workloads. V8 blog confirms JSON.parse is 1.7x faster than equivalent JS object literal evaluation.

**Expected speedup from switching away**: Minimal for our use case (small records, ~200-500 bytes each).

### simdjson Node.js Bindings (`simdjson` npm package)

**What it is**: Node.js native bindings for the C++ simdjson library (by Daniel Lemire). Claims gigabytes-per-second parsing throughput.

**API**:
```javascript
const simdjson = require('simdjson');
simdjson.isValid(jsonString);      // validate only
simdjson.lazyParse(jsonString);    // returns C++ proxy object
simdjson.parse(jsonString);        // full JS object conversion
```

**Performance**:
- **Large files (189MB)**: ~2.1x faster than JSON.parse via lazy parsing
- **Small files**: Mixed results, sometimes slower than native JSON.parse
- **Key issue**: C++ to JavaScript object conversion overhead negates parsing gains for small payloads
- `lazyParse` returns a C++ proxy - fast for selective field access but not for full object iteration

**Bun compatibility**: Unknown/untested. Uses N-API native bindings which Bun supports, but may have issues.

**Verdict for RecordStream**: **Not recommended**. Our records are small (typically <1KB each). The C++/JS boundary crossing overhead would likely make this slower, not faster. The lazy parsing approach doesn't help since we need full object access for operations like grep, eval, sort.

### everything-json (simdjson-based async parser)

**What it is**: Node.js library using simdjson internally with a two-stage approach:
1. First pass: Creates binary representation in background thread (async, non-blocking)
2. Second pass: Converts binary representation to JS objects (main thread)

**Performance**: 1,133 ops/sec for selective access (vs 66 ops/sec for yieldable-json).

**Verdict**: Interesting for server contexts where event loop blocking matters, but not applicable to our CLI pipeline use case. We process records sequentially, so async parsing adds overhead without benefit.

### Raw JSON.parse Optimization Patterns

1. **Avoid parsing then re-parsing**: Current `Record.fromJSON` does `JSON.parse(line)` then validates. This is fine.
2. **JSON.parse is a primitive**: In JSC/V8, this is highly optimized native code. Hard to beat in JS.
3. **Pre-validation is wasteful**: Don't validate JSON before parsing; just catch the error.

---

## JSON Serialization

### fast-json-stringify (Fastify project)

**What it is**: Schema-based JSON serializer that generates optimized stringification functions at startup time.

**How it works**: Given a JSON Schema, it generates a specialized function with pre-computed property access and type coercion, eliminating the need for runtime type checking.

**Performance** (Node.js v22):
- Short strings: **29.4M ops/sec** vs 12.1M for JSON.stringify (~2.4x faster)
- Objects: **7.3M ops/sec** vs 4.6M (~1.6x faster)
- Large arrays: 208 ops/sec vs 331 for JSON.stringify (**slower for large payloads**)

**API**:
```javascript
const fastJson = require('fast-json-stringify');
const stringify = fastJson({
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' },
    score: { type: 'number' },
    active: { type: 'boolean' },
  }
});
stringify({ name: 'test', age: 25, score: 98.5, active: true });
```

**Bun compatibility**: Should work - pure JS with no native bindings. Uses `ajv` for schema compilation.

**Implementation complexity**: Medium. Would need to:
1. Define a schema (or detect schema from first record)
2. Generate stringify function at pipeline startup
3. Fall back to JSON.stringify for records that don't match schema

**Verdict for RecordStream**: **Worth investigating for output-heavy pipelines**. The 1.6-2.4x speedup on small objects directly applies to our record serialization path. The schema could be inferred from the first few records.

### JSC's Built-in JSON.stringify SIMD Optimizations

**Finding**: JavaScriptCore's JSON.stringify includes SIMD-accelerated string copying:
- Vectorized scanning for quotes, escapes, and control characters
- `constexpr size_t stride = SIMD::stride<CharType>` - processes multiple characters simultaneously
- Available on ARM64 (NEON) and x86_64 (SSE/AVX via Clang)

**Implication**: Bun's JSON.stringify is already SIMD-optimized internally. The main overhead is in the object traversal and property enumeration, not the string output. fast-json-stringify wins by eliminating the traversal overhead.

### Manual Serialization

For known record shapes, manually concatenating strings can be faster than JSON.stringify:

```javascript
// Instead of JSON.stringify(record)
function serializeRecord(r) {
  return `{"id":${r.id},"name":${JSON.stringify(r.name)},"age":${r.age}}`;
}
```

**Expected speedup**: 2-5x for simple, known shapes.
**Downsides**: Fragile, hard to maintain, doesn't handle nested objects or edge cases.

**Verdict**: Not practical for RecordStream since record shapes vary. fast-json-stringify with schema detection is the better approach.

---

## Stream Processing & Stdin Reading

### Current RecordStream Approach

The codebase uses `Bun.stdin.stream()` with a manual line-buffering approach:

```typescript
const reader = Bun.stdin.stream().getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  // split on newlines...
}
```

### Bun's `for await (const line of console)`

**What it is**: Bun-specific API that treats `console` as an `AsyncIterable` yielding lines from stdin.

**Advantages**:
- Built-in line splitting at the native level (implemented in Zig)
- No manual TextDecoder management
- No string concatenation/buffering overhead in JS

**Disadvantage**: Less control over buffering behavior.

**Verdict**: Worth benchmarking against the current approach. If Bun handles the line splitting internally in Zig, it could be faster than our JS-level buffering.

### Optimizing the Current Line-Buffering

**Problem**: `buffer += decoder.decode(value)` creates a new string on every chunk. For large inputs, this causes O(n^2) string building.

**Optimization 1: Track buffer position instead of slicing**:
```typescript
let buffer = "";
let searchFrom = 0;

// Instead of: buffer = buffer.slice(newlineIdx + 1)
// Track the start position and only compact periodically
searchFrom = newlineIdx + 1;
if (searchFrom > 65536) {
  buffer = buffer.slice(searchFrom);
  searchFrom = 0;
}
```

**Expected speedup**: Significant for large inputs (avoids O(n) string copies per line).
**Implementation complexity**: Low.

**Optimization 2: Binary-level newline scanning**:
```typescript
// Scan for newlines in the raw Uint8Array before decoding
const bytes = value; // Uint8Array from reader
for (let i = 0; i < bytes.length; i++) {
  if (bytes[i] === 0x0A) { // newline
    // Only decode this chunk
    const line = decoder.decode(bytes.subarray(lineStart, i));
    lineStart = i + 1;
  }
}
```

**Expected speedup**: Moderate. Avoids decoding the entire chunk before scanning for newlines.
**Implementation complexity**: Medium. Need to handle multi-byte UTF-8 characters at chunk boundaries.

**Optimization 3: Use `Bun.ArrayBufferSink` for output buffering**:
```typescript
const sink = new Bun.ArrayBufferSink();
sink.start({ stream: true, highWaterMark: 1024 * 1024 }); // 1MB buffer

// Write records to sink, flush periodically
sink.write(record.toString() + "\n");
```

**Expected speedup**: Significant for output-heavy pipelines. Reduces syscall overhead.
**Implementation complexity**: Low.

### Bun.write vs console.log for Output

**Current**: `console.log(record.toString())` or `await Bun.write(Bun.stdout, line)`

**Bun.write** uses optimized syscalls (sendfile on Linux, fcopyfile on macOS) and avoids the overhead of console formatting.

**Recommended**: Use `Bun.write(Bun.stdout, line)` for all record output. Batch writes when possible.

### Bun's Direct ReadableStream

Bun offers an optimized `ReadableStream` variant with `type: "direct"`:
```typescript
new ReadableStream({
  type: "direct",
  pull(controller) {
    controller.write("data");
  }
});
```

This avoids unnecessary data copying and queue management. Could be useful for custom pipeline stages that produce output.

---

## Object Creation & GC Optimization

### Hidden Classes / Structures in JavaScriptCore

**Background**: JSC uses "Structures" (equivalent to V8's "Hidden Classes" or "Maps") to optimize property access. Objects with the same properties added in the same order share a Structure, enabling fast inline caching.

**Key principle**: When JSON.parse creates objects, JSC assigns Structures based on the property order in the JSON. If all records have the same keys in the same order (which they typically do in line-delimited JSON), they'll share Structures and get optimal JIT compilation.

**Optimization**: Ensure the Record class doesn't break Structure sharing:
- Don't dynamically add/remove properties after creation
- Process records through monomorphic code paths (same function, same argument types)
- Avoid using `delete` on record properties

### Record.clone() Optimization

**Current implementation**:
```typescript
clone(): Record {
  return new Record(JSON.parse(JSON.stringify(this.#data)) as JsonObject);
}
```

**Alternatives**:

1. **structuredClone** (built-in):
   ```typescript
   clone(): Record {
     return new Record(structuredClone(this.#data));
   }
   ```
   - Available in Bun natively
   - Handles circular references (JSON doesn't)
   - Performance: Typically 1.5-2x faster than JSON roundtrip for small objects
   - Bun implements this via the same HTML Structured Clone Algorithm exposed through `bun:jsc`'s `serialize`/`deserialize`

2. **Shallow clone + selective deep copy**:
   ```typescript
   clone(): Record {
     return new Record({ ...this.#data }); // shallow
   }
   ```
   - Only works if operations don't mutate nested objects
   - Much faster: simple object spread is very fast

3. **Copy-on-write with Proxy** (advanced):
   - Defer actual cloning until a write occurs
   - Complex to implement, but eliminates unnecessary clones

**Verdict**: Start with `structuredClone`, benchmark against current approach. Consider shallow clone where operations don't mutate nested fields.

### Object Pooling

**Concept**: Reuse Record objects instead of creating new ones, reducing GC pressure.

**Implementation**:
```typescript
class RecordPool {
  #pool: Record[] = [];

  acquire(data: JsonObject): Record {
    const record = this.#pool.pop();
    if (record) {
      record.setData(data); // reset with new data
      return record;
    }
    return new Record(data);
  }

  release(record: Record): void {
    this.#pool.push(record);
  }
}
```

**Expected benefit**: Reduces GC pauses in long-running pipelines processing millions of records.
**Implementation complexity**: Medium. Need to ensure records are properly released.
**Risk**: May not help much - modern GC (especially JSC's) handles short-lived objects well with generational collection.

**Verdict**: **Low priority**. Profile first to see if GC is actually a bottleneck. JSC's garbage collector is optimized for the "create many short-lived objects" pattern.

### TypedArray for Numeric Data

For numeric-heavy processing (aggregations, statistics), using TypedArrays can reduce GC pressure:

```typescript
// Instead of storing metrics as objects:
const views = new Float64Array(recordCount * 3); // views, clicks, ratio

// Pack data into typed array
views[i * 3] = record.metrics.views;
views[i * 3 + 1] = record.metrics.clicks;
views[i * 3 + 2] = record.metrics.ratio;
```

**Expected benefit**: Less GC pressure, better cache locality, SIMD-friendly data layout.
**Applicability**: Limited to specific operations (collate, percentile, etc.).

---

## String Processing

### Bun's Native String Utilities

Bun provides SIMD-optimized string functions:

- **`Bun.stringWidth()`**: 6,756x faster than `string-width` npm package for >500 chars
- **`Bun.escapeHTML()`**: Processes 480 MB/s - 20 GB/s depending on content
- **`Bun.stripANSI()`**: 6-57x faster than `strip-ansi` npm package

All implemented in Zig with SIMD (both ARM64 NEON and x86_64 SSE).

**Relevance**: If we need string width calculation for table formatting (`totable` operation), use `Bun.stringWidth()` instead of any npm package.

### String Concatenation vs Template Literals

In modern JS engines (including JSC), template literals and `+` concatenation perform similarly. However:

- **Rope strings**: JSC uses rope (concatenation tree) strings internally, deferring actual concatenation
- **For output**: Building a string with `+` or template literals then writing once is faster than multiple small writes

**Recommendation**: Buffer output lines and write in batches:
```typescript
const batch: string[] = [];
// ... accumulate lines ...
Bun.write(Bun.stdout, batch.join("\n") + "\n");
```

### indexOf for Line Splitting

`String.prototype.indexOf("\n")` is highly optimized in all engines. JSC uses SIMD for string search operations.

**Alternative**: For binary-level scanning, `Uint8Array.indexOf(0x0A)` on the raw bytes before decoding could be faster since it avoids creating the intermediate string.

---

## Bun-Specific Optimizations

### Bun.file() for File Input

When reading from files (not stdin), `Bun.file(path)` is heavily optimized:
- Uses `clonefile` on macOS, `copy_file_range` on Linux
- Lazy loading - doesn't read until accessed
- `await file.text()` reads entire file at once (faster than streaming for small files)
- `await file.json()` parses JSON directly from file (potentially faster than text + JSON.parse)

**Recommendation**: For `recs fromjsonarray < file.json`, detect if stdin is a file and use `Bun.file()` instead.

### Bun.write() Optimization

`Bun.write()` uses platform-specific optimized syscalls:
- Linux: `copy_file_range`, `sendfile`, `splice`
- macOS: `clonefile`, `fcopyfile`

**Current RecordStream output**:
```typescript
await Bun.write(Bun.stdout, line);  // one write per record
```

**Optimized**:
```typescript
// Batch multiple records before writing
const writer = Bun.stdout.writer();
writer.write(line1);
writer.write(line2);
// ...
writer.flush();
```

The `FileSink` API (`Bun.stdout.writer()`) provides buffered writing with configurable `highWaterMark`.

### Bun.nanoseconds() for Benchmarking

Already used in the benchmark framework. Provides nanosecond-precision timing:
```typescript
const start = Bun.nanoseconds();
// ... work ...
const elapsed = Bun.nanoseconds() - start;
```

### bun:jsc Serialize/Deserialize

For inter-process communication or caching:
```typescript
import { serialize, deserialize } from "bun:jsc";
const buf = serialize({ foo: "bar" });
const obj = deserialize(buf);
```

This uses the HTML Structured Clone Algorithm and is faster than JSON roundtrip for complex objects.

---

## Recommendations for RecordStream

### Priority 1: Output Buffering (High Impact, Low Effort)

**What**: Buffer output writes using `Bun.stdout.writer()` instead of individual `Bun.write()` calls.

**Why**: Reduces syscall overhead. Current code writes one line at a time to stdout.

**Expected speedup**: 2-5x for output throughput.

**Implementation**:
```typescript
const writer = Bun.stdout.writer({ highWaterMark: 64 * 1024 }); // 64KB buffer
// For each record:
writer.write(record.toString() + "\n");
// At end:
writer.end();
```

### Priority 2: Optimize Line Buffer Management (Medium Impact, Low Effort)

**What**: Avoid O(n) string slicing in the line buffer by tracking position instead.

**Why**: Current `buffer = buffer.slice(newlineIdx + 1)` creates a new string on every line.

**Expected speedup**: 1.5-3x for input processing of large streams.

### Priority 3: Benchmark `for await (const line of console)` (Medium Impact, Low Effort)

**What**: Compare Bun's native line iteration against our manual buffering.

**Why**: If Bun handles line splitting in Zig, it avoids all the JS-level string manipulation.

### Priority 4: structuredClone for Record.clone() (Medium Impact, Low Effort)

**What**: Replace `JSON.parse(JSON.stringify(data))` with `structuredClone(data)`.

**Why**: Typically 1.5-2x faster, handles edge cases better (Dates, undefined, etc.).

### Priority 5: Schema-Based Serialization (High Impact, Medium Effort)

**What**: Use `fast-json-stringify` with auto-detected schema for record output.

**Why**: 1.6-2.4x faster than JSON.stringify for small objects (our primary use case).

**Complexity**: Need schema inference from first record, fallback for schema mismatches.

### Priority 6: Binary-Level Newline Scanning (Medium Impact, Medium Effort)

**What**: Scan for `\n` bytes in raw Uint8Array before TextDecoder, only decode individual lines.

**Why**: Avoids creating one large string then scanning it again.

### Not Recommended

- **simdjson bindings**: C++/JS boundary overhead negates gains for small records
- **Object pooling**: JSC's GC handles short-lived objects well; profile first
- **Custom binary formats**: Over-engineering for a CLI tool
- **Lazy JSON parsing**: We need full object access for most operations

---

## References

- [JavaScriptCore JSONObject.cpp](https://github.com/nicolo-ribaudo/WebKit/blob/main/Source/JavaScriptCore/runtime/JSONObject.cpp) - JSC's JSON implementation with SIMD
- [Bun File I/O docs](https://bun.sh/docs/api/file-io) - Bun.file(), Bun.write(), FileSink
- [Bun Streams docs](https://bun.sh/docs/api/streams) - Direct ReadableStream, ArrayBufferSink
- [Bun Console docs](https://bun.sh/docs/api/console) - `for await (const line of console)`
- [fast-json-stringify](https://github.com/fastify/fast-json-stringify) - Schema-based JSON serializer
- [simdjson_nodejs](https://github.com/luizperes/simdjson_nodejs) - simdjson Node.js bindings
- [V8 blog: Cost of JavaScript 2019](https://v8.dev/blog/cost-of-javascript-2019) - JSON.parse performance insights
- [mrale.ph: Maybe you don't need Rust](https://mrale.ph/blog/2018/02/03/maybe-you-dont-need-rust-to-speed-up-your-js.html) - JS optimization patterns
