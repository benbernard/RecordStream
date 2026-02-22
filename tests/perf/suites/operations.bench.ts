/**
 * Benchmark: Core operations (grep, eval, xform, sort, collate, fromcsv)
 *
 * Runs each operation through the Operation.acceptRecord / finish pipeline
 * to measure per-operation overhead.
 */

import { BenchmarkSuite } from "../bench.ts";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import { GrepOperation } from "../../../src/operations/transform/grep.ts";
import { EvalOperation } from "../../../src/operations/transform/eval.ts";
import { XformOperation } from "../../../src/operations/transform/xform.ts";
import { SortOperation } from "../../../src/operations/transform/sort.ts";
import { CollateOperation } from "../../../src/operations/transform/collate.ts";
import { FromCsv } from "../../../src/operations/input/fromcsv.ts";
import { generateRecords, generateCsvString, SIZES } from "../fixtures.ts";

function makeRecords(count: number): Record[] {
  return generateRecords(count).map((d) => new Record(d));
}

function runOperation(
  OpClass: new (next: CollectorReceiver) => {
    init(args: string[]): void;
    acceptRecord(record: Record): boolean;
    finish(): void;
  },
  args: string[],
  records: Record[],
): Record[] {
  const collector = new CollectorReceiver();
  const op = new OpClass(collector);
  op.init(args);
  for (const rec of records) {
    op.acceptRecord(rec);
  }
  op.finish();
  return collector.records;
}

export function createOperationsSuite(filter?: string): BenchmarkSuite {
  const suite = new BenchmarkSuite("Core Operations", { filter });

  const mediumRecs = makeRecords(SIZES.medium);

  // ---- grep ----

  suite.add(
    "grep — 10K records (r.age > 50)",
    () => {
      runOperation(
        GrepOperation as never,
        ["r.age > 50"],
        mediumRecs,
      );
    },
    { iterations: 10, recordCount: SIZES.medium },
  );

  suite.add(
    "grep — 10K records (string match)",
    () => {
      runOperation(
        GrepOperation as never,
        ["r.name === 'Alice'"],
        mediumRecs,
      );
    },
    { iterations: 10, recordCount: SIZES.medium },
  );

  // ---- eval ----

  suite.add(
    "eval — 10K records (add computed field)",
    () => {
      runOperation(
        EvalOperation as never,
        ["r.score_doubled = r.score * 2"],
        mediumRecs,
      );
    },
    { iterations: 10, recordCount: SIZES.medium },
  );

  // ---- xform ----

  suite.add(
    "xform — 10K records (push each record)",
    () => {
      runOperation(
        XformOperation as never,
        ["r.processed = true"],
        mediumRecs,
      );
    },
    { iterations: 10, recordCount: SIZES.medium },
  );

  // ---- sort ----

  // Sort needs fresh record copies each time since it collects them
  suite.add(
    "sort — 100 records (by score, numeric)",
    () => {
      const recs = makeRecords(SIZES.small);
      runOperation(
        SortOperation as never,
        ["--key", "score=numeric"],
        recs,
      );
    },
    { iterations: 20, recordCount: SIZES.small },
  );

  suite.add(
    "sort — 10K records (by score, numeric)",
    () => {
      const recs = makeRecords(SIZES.medium);
      runOperation(
        SortOperation as never,
        ["--key", "score=numeric"],
        recs,
      );
    },
    { iterations: 5, recordCount: SIZES.medium },
  );

  suite.add(
    "sort — 10K records (by name, lexical)",
    () => {
      const recs = makeRecords(SIZES.medium);
      runOperation(
        SortOperation as never,
        ["--key", "name"],
        recs,
      );
    },
    { iterations: 5, recordCount: SIZES.medium },
  );

  // ---- collate ----

  suite.add(
    "collate — 100 records (count by city)",
    () => {
      const recs = makeRecords(SIZES.small);
      runOperation(
        CollateOperation as never,
        ["--key", "city", "-a", "count"],
        recs,
      );
    },
    { iterations: 20, recordCount: SIZES.small },
  );

  suite.add(
    "collate — 10K records (count by city)",
    () => {
      const recs = makeRecords(SIZES.medium);
      runOperation(
        CollateOperation as never,
        ["--key", "city", "-a", "count"],
        recs,
      );
    },
    { iterations: 5, recordCount: SIZES.medium },
  );

  // ---- fromcsv ----

  const mediumCsv = generateCsvString(SIZES.medium);
  const csvBytes = Buffer.byteLength(mediumCsv, "utf-8");

  suite.add(
    "fromcsv — 10K rows (parse CSV to records)",
    () => {
      const collector = new CollectorReceiver();
      const op = new FromCsv(collector);
      op.init(["--header"]);
      (op as unknown as { parseContent(content: string): void }).parseContent(mediumCsv);
      op.finish();
    },
    { iterations: 5, recordCount: SIZES.medium, byteCount: csvBytes },
  );

  return suite;
}
