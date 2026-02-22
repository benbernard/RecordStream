<p align="center">
  <img src="docs/public/logo-hero.png" alt="RecordStream" width="200">
</p>

<h1 align="center">RecordStream</h1>

<p align="center">
  A toolkit for creating, transforming, and outputting streams of JSON records.
  <br>
  <a href="https://benbernard.github.io/RecordStream/">Documentation</a> · <a href="https://benbernard.github.io/RecordStream/guide/getting-started">Getting Started</a> · <a href="https://benbernard.github.io/RecordStream/reference/">Command Reference</a>
</p>

---

Records are JSON objects, one per line. RecordStream provides 40+ composable CLI
commands that pipe together to build data processing pipelines — Unix philosophy
meets structured data.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/benbernard/RecordStream/master/install.sh | bash
```

This detects your platform (linux/darwin, x64/arm64), downloads the correct
binary, and installs it to `/usr/local/bin` (or `~/.local/bin` if that's not
writable).

```bash
# Custom install directory
INSTALL_DIR=~/bin curl -fsSL https://raw.githubusercontent.com/benbernard/RecordStream/master/install.sh | bash

# Specific version
VERSION=v1.0.0 curl -fsSL https://raw.githubusercontent.com/benbernard/RecordStream/master/install.sh | bash
```

### Auto-update

`recs` checks for new versions in the background (at most once per day). When an
update is available, you'll see a notice on stderr:

```
recs v1.2.0 available (current: v1.1.0). Run: recs --update
```

- **`recs --update`** — download and install the latest version
- **`recs --no-update-check`** — suppress the check for this invocation

## Quick Example

```bash
# Who's spending the most?
recs fromcsv --header purchases.csv          \
  | recs collate --key customer -a sum,amount \
  | recs sort --key amount=-n                 \
  | recs totable
```

```
customer   sum_amount
--------   ----------
Alice      9402.50
Bob        7281.00
Charlie    3104.75
```

## More Examples

```bash
# How many processes per user?
recs fromps \
  | recs collate --key uid -a count \
  | recs sort --key count=-n \
  | recs totable

# Parse CSV, filter, and output as a table
recs fromcsv --header < data.csv \
  | recs grep '{{age}} > 25' \
  | recs totable

# Transform records
cat data.jsonl \
  | recs xform '{{upper}} = {{name}}.toUpperCase()' \
  | recs sort --key name

# Parse nested JSON out of string fields
cat logs.jsonl \
  | recs expandjson --key payload --recursive \
  | recs grep '{{payload/level}} === "error"'
```

Run `recs help` for the full command list, or `recs help <command>` for detailed
help on any command.

## Commands

### Input (`from*`)

Read data from various sources into record streams.

`fromapache` `fromatomfeed` `fromcsv` `fromdb` `fromjsonarray` `fromkv`
`frommongo` `frommultire` `fromps` `fromre` `fromsplit` `fromtcpdump`
`fromxferlog` `fromxml`

### Transform

Filter, sort, aggregate, and modify record streams.

`annotate` `assert` `chain` `collate` `decollate` `delta` `eval` `expandjson`
`flatten` `generate` `grep` `join` `multiplex` `normalizetime` `sort`
`stream2table` `substream` `topn` `xform`

### Output (`to*`)

Format and output record streams.

`tocsv` `todb` `togdgraph` `tognuplot` `tohtml` `tojsonarray` `toprettyprint`
`toptable` `totable`

## Documentation

Full documentation is at **[benbernard.github.io/RecordStream](https://benbernard.github.io/RecordStream/)**.

- [Getting Started](https://benbernard.github.io/RecordStream/guide/getting-started) — five-minute intro
- [The Pipeline Model](https://benbernard.github.io/RecordStream/guide/pipeline) — philosophy and design
- [Key Specs](https://benbernard.github.io/RecordStream/guide/key-specs) — navigating nested data with `{{key/path}}`
- [Snippets](https://benbernard.github.io/RecordStream/guide/snippets) — inline code expressions
- [Aggregators](https://benbernard.github.io/RecordStream/guide/aggregators) — count, sum, avg, percentile, and more
- [Command Reference](https://benbernard.github.io/RecordStream/reference/) — every command, every flag

You can also run `recs story` or `recs examples` for built-in guides.

## Architecture

RecordStream is built with [Bun](https://bun.sh) and TypeScript. It compiles to
a standalone binary with no runtime dependencies.

```
bin/recs.ts              CLI entry point
src/
  Record.ts              Core Record class (JSON object wrapper)
  RecordStream.ts        Fluent API for programmatic use
  Operation.ts           Base class for all operations
  InputStream.ts         Read JSON lines from stdin/files
  OutputStream.ts        Write records to stdout/streams
  Executor.ts            Compile and run user code snippets
  Aggregator.ts          Aggregation framework (count, sum, percentile, etc.)
  KeySpec.ts             Nested key access (e.g. "foo/bar")
  KeyGroups.ts           Key group specifications
  updater.ts             Background auto-update system
  cli/
    dispatcher.ts        Route commands to operations
    help.ts              Help system and man page rendering
    operation-registry.ts  Static registry of all operations
  operations/
    input/               from* operations (14 commands)
    transform/           grep, sort, collate, etc. (19 commands)
    output/              to* operations (9 commands)
  snippets/              Multi-language snippet runners (JS, Python, Perl)
scripts/
  generate-manpages.ts   Generate man pages from CommandDoc metadata
  generate-reference-docs.ts  Generate VitePress reference pages
  check-docs.ts          Verify every operation has documentation
tests/                   Test suite (681 tests, bun:test)
docs/                    VitePress documentation site
install.sh               curl|bash installer
```

## Development

```bash
# Install Bun (https://bun.sh)
curl -fsSL https://bun.sh/install | bash

# Clone and install
git clone https://github.com/benbernard/RecordStream.git
cd RecordStream
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint

# Build standalone binary
bun run build

# Run docs site locally
bun run docs:dev
```

## History

RecordStream was originally written in Perl as
[App::RecordStream](https://metacpan.org/pod/App::RecordStream) and published on
CPAN. The original Perl implementation (v4.0.25) is preserved in the `perl/`
directory for historical reference. The Perl code, tests, Dist::Zilla config,
and Travis CI config in that directory are **not actively maintained** — they
exist purely as a record of the project's origins.

The TypeScript rewrite is a ground-up reimplementation that preserves the
original command names, flag interfaces, and pipeline semantics while taking
advantage of modern tooling (Bun for runtime and compilation, VitePress for
docs, GitHub Actions for CI/CD and releases).

## License

MIT
