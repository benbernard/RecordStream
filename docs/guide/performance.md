# Performance

RecordStream is built on [Bun](https://bun.sh) and takes advantage of its optimized runtime to deliver high throughput for JSON stream processing. This page covers key performance characteristics, optimization strategies, and benchmark results.

## Chain vs Shell Pipes

The single biggest performance win in RecordStream is using **in-memory chaining** instead of shell pipes. When you connect recs commands with `|`, each command runs as a separate process — data gets serialized to JSON, piped through the OS, and re-parsed on the other side.

Both `recs chain` and implicit chaining (`\|`) use the same in-memory `ChainOperation` code path with zero serialization overhead:

```bash
# Shell pipes: ~43K records/sec (5 stages, 10K records)
recs grep '{{age}} > 25' | recs eval '{{x}} = 1' | recs grep '{{x}}' | recs eval '{{y}} = 2' | recs grep '{{y}}'

# In-memory chain: ~22M records/sec — 500x+ faster
recs chain 'grep "{{age}} > 25"' 'eval "{{x}} = 1"' 'grep "{{x}}"' 'eval "{{y}} = 2"' 'grep "{{y}}"'

# Implicit chaining uses the same in-memory path — identical performance
recs grep '{{age}} > 25' \| eval '{{x}} = 1' \| grep '{{x}}' \| eval '{{y}} = 2' \| grep '{{y}}'
```

### Why the difference?

Each shell pipe stage costs ~40-50ms of Bun startup time, plus JSON serialization/deserialization at every boundary. In-memory chain passes Record objects directly between operations — no process spawning, no JSON roundtrips.

| Pipeline | 100 records | 1K records | 10K records |
|----------|-------------|------------|-------------|
| 2 ops (chain) | 84µs | 146µs | 517µs |
| 2 ops (pipe) | 91ms | 87ms | 92ms |
| 5 ops (chain) | 54µs | 90µs | 450µs |
| 5 ops (pipe) | 235ms | 235ms | 235ms |

**Recommendation**: For recs-only pipelines, always prefer `recs chain` or implicit chaining — both are equivalent. Use shell pipes only when mixing recs with other Unix tools.

## Core Throughput

Benchmark results on macOS (Apple Silicon), Bun 1.3.4:

### Record Operations

| Operation | Throughput |
|-----------|-----------|
| `new Record(data)` | ~96M records/sec |
| `Record.get(key)` | ~720M accesses/sec |
| `Record.set(key, val)` | ~186M writes/sec |
| `Record.dataRef()` (zero-copy) | ~314M records/sec |
| `Record.toJSON()` | ~31M records/sec |
| `Record.toString()` (JSON serialize) | ~2.3M records/sec |
| `Record.clone()` | ~267K records/sec |
| `Record.fromJSON(line)` | ~1.4M records/sec (~420 MB/sec) |

### Key Access

| Access Pattern | Throughput |
|----------------|-----------|
| Simple key (`name`) | ~65M lookups/sec |
| Nested key (`address/zip`) | ~11M lookups/sec |
| Deep nested (`address/coords/lat`) | ~9M lookups/sec |
| Array index (`tags/#0`) | ~9M lookups/sec |
| Direct property access (baseline) | ~312M lookups/sec |

### Sorting

| Operation | Throughput |
|-----------|-----------|
| Numeric sort (10K records) | ~491K records/sec |
| Lexical sort (10K records) | ~1.0M records/sec |
| Single-field comparison | ~1M comparisons in <1ms |

## Optimization Details

RecordStream includes several targeted optimizations based on profiling:

### Output Buffering

Output uses Bun's `FileSink` API (`Bun.stdout.writer()`) for buffered writes instead of individual `write()` calls per record. This reduces syscall overhead significantly for output-heavy pipelines.

### Input Stream Position Tracking

The line-reading buffer tracks a position offset rather than slicing the buffer string on every line. This avoids O(n) string copies per line read, with deferred compaction only when new data arrives from the stream.

### KeySpec Fast Path

Simple key access (single key, no nesting, no fuzzy matching) bypasses the full KeySpec parsing and resolution machinery. A charcode scan detects simple keys and resolves them with a direct property lookup — within 5x of raw JavaScript property access.

### Record.clone() with structuredClone

`Record.clone()` uses `structuredClone()` instead of the `JSON.parse(JSON.stringify())` roundtrip. This is the native HTML Structured Clone Algorithm, which handles more types and avoids the string serialization intermediate.

## Running Benchmarks

RecordStream includes a benchmark suite you can run yourself:

```bash
# Run all benchmarks
bun tests/perf/run.ts

# Run a specific suite
bun tests/perf/run.ts --suite record
bun tests/perf/run.ts --suite keyspec
bun tests/perf/run.ts --suite parsing
bun tests/perf/run.ts --suite serialization
bun tests/perf/run.ts --suite operations
bun tests/perf/run.ts --suite pipeline
bun tests/perf/run.ts --suite chain-vs-pipe

# Filter by benchmark name
bun tests/perf/run.ts --filter sort

# Save results as baseline for future comparison
bun tests/perf/run.ts --save-baseline
```

The benchmark harness uses `Bun.nanoseconds()` for high-resolution timing and reports min/median/p95/max statistics with throughput calculations. When a baseline exists, it shows percentage deltas to track regressions.

## Tips for Fast Pipelines

1. **Use `recs chain` or implicit chaining for multi-stage recs pipelines** — 500x+ faster than shell pipes
2. **Put streaming operations first** — `grep` and `eval` before `sort` or `collate` to reduce buffered data
3. **Use `dataRef()` instead of `toJSON()` when you don't need a copy** — zero-copy access is 10x faster
4. **Prefer simple key specs** — `name` is 6x faster than `address/coords/lat`
5. **Avoid unnecessary cloning** — `Record.clone()` is the most expensive common operation
