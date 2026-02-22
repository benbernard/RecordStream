/**
 * Benchmark: In-memory chain vs shell pipes
 *
 * Compares three approaches for chaining recs operations:
 *   1. In-memory chain via ChainOperation (records stay in-memory)
 *   2. Shell pipes via child_process (spawn separate recs processes piped together)
 *   3. Implicit chaining (same as #1 but triggered via `|` in bin/recs.ts)
 *
 * Tests varying record counts (100, 1000, 10000) and chain lengths (2, 3, 5 ops).
 */

import { BenchmarkSuite } from "../bench.ts";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { RecordReceiver } from "../../../src/Operation.ts";
import {
  ChainOperation,
  registerOperationFactory,
} from "../../../src/operations/transform/chain.ts";
import { GrepOperation } from "../../../src/operations/transform/grep.ts";
import { EvalOperation } from "../../../src/operations/transform/eval.ts";
import { generateRecords } from "../fixtures.ts";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Ensure chain-needed operations are registered
// ---------------------------------------------------------------------------

registerOperationFactory(
  "grep",
  (next: RecordReceiver) => new GrepOperation(next),
);
registerOperationFactory(
  "eval",
  (next: RecordReceiver) => new EvalOperation(next),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECS_BIN = join(import.meta.dir, "..", "..", "..", "bin", "recs.ts");

function makeRecords(count: number): Record[] {
  return generateRecords(count).map((d) => new Record(d));
}

/** Serialize records to JSONL for piping to shell processes. */
function toJsonl(records: Record[]): string {
  return records.map((r) => r.toString()).join("\n") + "\n";
}

/**
 * Run an in-memory chain via ChainOperation.
 */
function runChain(args: string[], records: Record[]): Record[] {
  const collector = new CollectorReceiver();
  const chain = new ChainOperation(collector);
  chain.init(args);
  chain.feedRecords(records);
  chain.finish();
  return collector.records;
}

/**
 * Chain lengths: each defines the chain args and equivalent shell pipeline.
 *
 * We use operations that work without complex setup:
 *   - grep with a simple expression
 *   - eval adding a computed field
 */
interface ChainSpec {
  label: string;
  /** Args for ChainOperation.init() (pipe-separated) */
  chainArgs: string[];
  /** Array of [command, ...args] for each pipeline stage */
  pipeStages: string[][];
}

const CHAIN_2: ChainSpec = {
  label: "2 ops (grep|eval)",
  chainArgs: ["grep", "r.age > 20", "|", "eval", "r.doubled = r.score * 2"],
  pipeStages: [
    ["grep", "r.age > 20"],
    ["eval", "r.doubled = r.score * 2"],
  ],
};

const CHAIN_3: ChainSpec = {
  label: "3 ops (grep|eval|grep)",
  chainArgs: [
    "grep", "r.age > 20",
    "|", "eval", "r.doubled = r.score * 2",
    "|", "grep", "r.doubled > 10",
  ],
  pipeStages: [
    ["grep", "r.age > 20"],
    ["eval", "r.doubled = r.score * 2"],
    ["grep", "r.doubled > 10"],
  ],
};

const CHAIN_5: ChainSpec = {
  label: "5 ops (grep|eval|grep|eval|grep)",
  chainArgs: [
    "grep", "r.age > 20",
    "|", "eval", "r.doubled = r.score * 2",
    "|", "grep", "r.doubled > 10",
    "|", "eval", "r.label = r.name + '-' + r.city",
    "|", "grep", "r.active",
  ],
  pipeStages: [
    ["grep", "r.age > 20"],
    ["eval", "r.doubled = r.score * 2"],
    ["grep", "r.doubled > 10"],
    ["eval", "r.label = r.name + '-' + r.city"],
    ["grep", "r.active"],
  ],
};

const RECORD_SIZES = [100, 1_000, 10_000] as const;

/**
 * Run a shell pipeline by spawning `bun bin/recs.ts <op> <args>` processes
 * piped together via spawnSync for each stage sequentially.
 *
 * Each stage reads JSONL from stdin and writes JSONL to stdout.
 */
function runShellPipeline(stages: string[][], jsonlInput: string): string {
  let currentInput = jsonlInput;

  for (const [cmd, ...args] of stages) {
    const result = spawnSync("bun", [RECS_BIN, cmd!, "--no-update-check", ...args], {
      input: currentInput,
      encoding: "utf-8",
      shell: false,
      maxBuffer: 100 * 1024 * 1024,
    });

    if (result.error) {
      throw new Error(`Shell pipe stage '${cmd}' failed: ${result.error.message}`);
    }

    currentInput = result.stdout ?? "";
  }

  return currentInput;
}

/**
 * Run the implicit chain path in-memory: simulate what bin/recs.ts does when
 * it detects "|" in the CLI args.  bin/recs.ts calls:
 *
 *   runOperation("chain", [resolvedCommand, ...restArgs])
 *
 * which creates a ChainOperation and feeds it the pipe-delimited args — the
 * exact same in-memory code path as explicit `recs chain`.  The previous
 * implementation spawned a subprocess, which measured Bun startup time (~44ms)
 * instead of the actual implicit chain overhead (~0).
 */
function runImplicitChain(spec: ChainSpec, records: Record[]): Record[] {
  // Build the flat args the same way bin/recs.ts would construct them:
  // [first-command, first-args..., |, next-command, next-args..., ...]
  const flatArgs: string[] = [];
  for (let i = 0; i < spec.pipeStages.length; i++) {
    if (i > 0) flatArgs.push("|");
    flatArgs.push(...spec.pipeStages[i]!);
  }

  // This is identical to what bin/recs.ts passes to runOperation("chain", ...)
  return runChain(flatArgs, records);
}

// ---------------------------------------------------------------------------
// Suite factory
// ---------------------------------------------------------------------------

export function createChainVsPipeSuite(filter?: string): BenchmarkSuite {
  const suite = new BenchmarkSuite("Chain vs Pipe", { filter });

  // Pre-generate records and JSONL for each size
  const recordSets = new Map<number, { records: Record[]; jsonl: string }>();
  for (const size of RECORD_SIZES) {
    const records = makeRecords(size);
    const jsonl = toJsonl(records);
    recordSets.set(size, { records, jsonl });
  }

  const specs: ChainSpec[] = [CHAIN_2, CHAIN_3, CHAIN_5];

  for (const spec of specs) {
    for (const size of RECORD_SIZES) {
      const { records, jsonl } = recordSets.get(size)!;
      const sizeLabel = size >= 1000 ? `${size / 1000}K` : String(size);

      // Adjust iterations: fewer for large sizes and shell pipes (they're slow)
      const chainIter = size >= 10_000 ? 5 : 10;
      const pipeIter = size >= 10_000 ? 3 : 5;

      // --- In-memory chain ---
      suite.add(
        `chain — ${spec.label}, ${sizeLabel} records`,
        () => {
          runChain(spec.chainArgs, records);
        },
        { iterations: chainIter, recordCount: size },
      );

      // --- Shell pipes ---
      suite.add(
        `pipe  — ${spec.label}, ${sizeLabel} records`,
        () => {
          runShellPipeline(spec.pipeStages, jsonl);
        },
        { iterations: pipeIter, recordCount: size },
      );

      // --- Implicit chain (in-memory, same code path bin/recs.ts uses) ---
      suite.add(
        `implicit — ${spec.label}, ${sizeLabel} records`,
        () => {
          runImplicitChain(spec, records);
        },
        { iterations: chainIter, recordCount: size },
      );
    }
  }

  return suite;
}
