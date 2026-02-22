#!/usr/bin/env bun
/**
 * RecordStream benchmark runner.
 *
 * Usage:
 *   bun run bench                     # run all benchmarks
 *   bun run bench -- --filter sort    # only benchmarks matching "sort"
 *   bun run bench -- --save-baseline  # save results as baseline for future comparison
 *   bun run bench -- --suite record   # only run the "record" suite
 */

import { runAllSuites, type BenchmarkSuite } from "./bench.ts";
import { createJsonParsingSuite } from "./suites/json-parsing.bench.ts";
import { createJsonSerializationSuite } from "./suites/json-serialization.bench.ts";
import { createKeySpecSuite } from "./suites/keyspec.bench.ts";
import { createOperationsSuite } from "./suites/operations.bench.ts";
import { createPipelineSuite } from "./suites/pipeline.bench.ts";
import { createRecordSuite } from "./suites/record.bench.ts";

// ---------------------------------------------------------------------------
// Parse CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let filter: string | undefined;
let saveBaseline = false;
let suiteFilter: string | undefined;

for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (arg === "--filter" && args[i + 1]) {
    filter = args[++i];
  } else if (arg === "--save-baseline") {
    saveBaseline = true;
  } else if (arg === "--suite" && args[i + 1]) {
    suiteFilter = args[++i];
  } else if (arg === "--help") {
    console.log(`Usage: bun tests/perf/run.ts [options]

Options:
  --filter <str>     Only run benchmarks whose name contains <str>
  --suite <name>     Only run a specific suite (parsing, serialization, keyspec,
                     operations, pipeline, record)
  --save-baseline    Save results as baseline for future comparison
  --help             Show this help message
`);
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// Build suites
// ---------------------------------------------------------------------------

const allSuiteFactories: Record<string, (f?: string) => BenchmarkSuite> = {
  parsing: createJsonParsingSuite,
  serialization: createJsonSerializationSuite,
  keyspec: createKeySpecSuite,
  operations: createOperationsSuite,
  pipeline: createPipelineSuite,
  record: createRecordSuite,
};

const suiteNames = suiteFilter
  ? Object.keys(allSuiteFactories).filter((n) => n.includes(suiteFilter!))
  : Object.keys(allSuiteFactories);

if (suiteNames.length === 0) {
  console.error(`No suite matching "${suiteFilter}" found.`);
  console.error(`Available: ${Object.keys(allSuiteFactories).join(", ")}`);
  process.exit(1);
}

const suites = suiteNames.map((name) => allSuiteFactories[name]!(filter));

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

await runAllSuites(suites, { saveBaseline });
