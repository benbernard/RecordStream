# RecordStream

A toolkit for creating, transforming, and outputting streams of JSON records.

Records are JSON objects, one per line. RecordStream provides a set of composable
CLI commands that can be piped together to build data processing pipelines.

## Quick Start

```bash
# Install Bun (https://bun.sh)
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone https://github.com/benbernard/RecordStream.git
cd RecordStream
bun install

# Try it out
echo '{"name":"alice","age":30}' | bun bin/recs.ts grep '{{age}} > 25'
```

## Example Pipelines

```bash
# How many processes per user?
bun bin/recs.ts fromps \
  | bun bin/recs.ts collate --key uid -a count \
  | bun bin/recs.ts sort --key count=n \
  | bun bin/recs.ts totable

# Parse CSV, filter, and output as a table
bun bin/recs.ts fromcsv --header < data.csv \
  | bun bin/recs.ts grep '{{age}} > 25' \
  | bun bin/recs.ts totable

# Transform and sort records
cat data.jsonl \
  | bun bin/recs.ts xform '{{upper}} = {{name}}.toUpperCase()' \
  | bun bin/recs.ts sort --key name
```

## Commands

RecordStream includes 41 commands organized into three categories:

### Input (from\*)
Read data from various sources into record streams.

`fromapache` `fromatomfeed` `fromcsv` `fromdb` `fromjsonarray` `fromkv`
`frommongo` `frommultire` `fromps` `fromre` `fromsplit` `fromtcpdump`
`fromxferlog` `fromxml`

### Transform
Filter, sort, aggregate, and modify record streams.

`annotate` `assert` `chain` `collate` `decollate` `delta` `eval` `flatten`
`generate` `grep` `join` `multiplex` `normalizetime` `sort` `stream2table`
`substream` `topn` `xform`

### Output (to\*)
Format and output record streams.

`tocsv` `todb` `togdgraph` `tognuplot` `tohtml` `tojsonarray` `toprettyprint`
`toptable` `totable`

Run `bun bin/recs.ts help` for the full command list, or `bun bin/recs.ts help <command>`
for detailed help on any command.

## Development

```bash
# Run tests
bun test

# Type check
bunx tsc --noEmit

# Lint
bunx oxlint src/ tests/ bin/ scripts/

# Generate man pages
bun scripts/generate-manpages.ts

# Check documentation coverage
bun scripts/check-docs.ts
```

## Documentation

- Run `bun bin/recs.ts examples` for example pipelines
- Run `bun bin/recs.ts story` for a narrative introduction
- See the `docs/` directory for the full documentation site

## Architecture

RecordStream is built with [Bun](https://bun.sh) and TypeScript. The codebase is
organized as:

```
src/
  Record.ts          - Core Record class (JSON object wrapper)
  Operation.ts       - Base class for all operations
  InputStream.ts     - Read JSON lines from stdin/files
  OutputStream.ts    - Write records to stdout/streams
  Executor.ts        - Compile and run user code snippets
  Aggregator.ts      - Aggregation framework (count, sum, etc.)
  KeySpec.ts         - Nested key access (e.g. "foo/bar")
  KeyGroups.ts       - Key group specifications
  cli/               - CLI dispatcher and help system
  operations/
    input/           - from* operations
    transform/       - grep, sort, collate, etc.
    output/          - to* operations
tests/               - Test suite (bun:test)
bin/recs.ts          - CLI entry point
```

## Perl Version

The original Perl implementation is preserved in the `perl/` directory for reference.

## License

MIT
