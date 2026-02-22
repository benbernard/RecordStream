/**
 * Benchmark: Pipeline overhead
 *
 * Measures the cost of chaining operations: single op vs chain of 3 vs chain of 5.
 * Uses the ChainOperation to create in-memory pipelines.
 */

import { BenchmarkSuite } from "../bench.ts";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { RecordReceiver } from "../../../src/Operation.ts";
import { ChainOperation, registerOperationFactory } from "../../../src/operations/transform/chain.ts";
import { GrepOperation } from "../../../src/operations/transform/grep.ts";
import { EvalOperation } from "../../../src/operations/transform/eval.ts";
import { generateRecords, SIZES } from "../fixtures.ts";

// Register the operations needed by the chain benchmarks
registerOperationFactory("grep", (next: RecordReceiver) => new GrepOperation(next));
registerOperationFactory("eval", (next: RecordReceiver) => new EvalOperation(next));

function makeRecords(count: number): Record[] {
  return generateRecords(count).map((d) => new Record(d));
}

function runChain(args: string[], records: Record[]): Record[] {
  const collector = new CollectorReceiver();
  const chain = new ChainOperation(collector);
  chain.init(args);
  chain.feedRecords(records);
  chain.finish();
  return collector.records;
}

export function createPipelineSuite(filter?: string): BenchmarkSuite {
  const suite = new BenchmarkSuite("Pipeline Overhead", { filter });

  const count = SIZES.medium;

  // ---- Single operation (grep only) ----

  suite.add(
    "chain — single op (grep), 10K records",
    () => {
      const recs = makeRecords(count);
      runChain(["grep", "r.age > 30"], recs);
    },
    { iterations: 5, recordCount: count },
  );

  // ---- Chain of 3 operations ----

  suite.add(
    "chain — 3 ops (grep | eval | grep), 10K records",
    () => {
      const recs = makeRecords(count);
      runChain(
        ["grep", "r.age > 20", "|", "eval", "r.doubled = r.score * 2", "|", "grep", "r.doubled > 50"],
        recs,
      );
    },
    { iterations: 5, recordCount: count },
  );

  // ---- Chain of 5 operations ----

  suite.add(
    "chain — 5 ops (grep|eval|grep|eval|grep), 10K records",
    () => {
      const recs = makeRecords(count);
      runChain(
        [
          "grep", "r.age > 20",
          "|", "eval", "r.doubled = r.score * 2",
          "|", "grep", "r.doubled > 10",
          "|", "eval", "r.label = r.name + '-' + r.city",
          "|", "grep", "r.active",
        ],
        recs,
      );
    },
    { iterations: 5, recordCount: count },
  );

  // ---- Passthrough baseline (no-op chain, direct push) ----

  suite.add(
    "passthrough baseline — 10K records (direct collector)",
    () => {
      const recs = makeRecords(count);
      const collector = new CollectorReceiver();
      for (const rec of recs) {
        collector.acceptRecord(rec);
      }
      collector.finish();
    },
    { iterations: 10, recordCount: count },
  );

  return suite;
}
