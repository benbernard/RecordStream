/**
 * Benchmark: Record creation, toJSON(), toString(), clone()
 *
 * Measures the fundamental Record object overhead.
 */

import { BenchmarkSuite } from "../bench.ts";
import { Record } from "../../../src/Record.ts";
import { generateRecords, SIZES } from "../fixtures.ts";

export function createRecordSuite(filter?: string): BenchmarkSuite {
  const suite = new BenchmarkSuite("Record Creation & Serialization", { filter });

  const mediumData = generateRecords(SIZES.medium);
  const mediumRecs = mediumData.map((d) => new Record(d));
  const count = mediumData.length;

  // ---- new Record() from plain objects ----

  suite.add(
    "new Record() — 10K objects",
    () => {
      for (const data of mediumData) {
        new Record(data);
      }
    },
    { iterations: 20, recordCount: count },
  );

  // ---- new Record() empty ----

  suite.add(
    "new Record() empty — 10K",
    () => {
      for (let i = 0; i < count; i++) {
        new Record();
      }
    },
    { iterations: 20, recordCount: count },
  );

  // ---- Record.get() ----

  suite.add(
    "Record.get — 10K records × 3 fields",
    () => {
      for (const rec of mediumRecs) {
        rec.get("name");
        rec.get("age");
        rec.get("score");
      }
    },
    { iterations: 20, recordCount: count * 3 },
  );

  // ---- Record.set() ----

  suite.add(
    "Record.set — 10K records × 1 field",
    () => {
      for (const rec of mediumRecs) {
        rec.set("temp", 42);
      }
    },
    { iterations: 20, recordCount: count },
  );

  // ---- Record.toJSON() ----

  suite.add(
    "Record.toJSON — 10K records",
    () => {
      for (const rec of mediumRecs) {
        rec.toJSON();
      }
    },
    { iterations: 10, recordCount: count },
  );

  // ---- Record.toString() ----

  suite.add(
    "Record.toString — 10K records",
    () => {
      for (const rec of mediumRecs) {
        rec.toString();
      }
    },
    { iterations: 10, recordCount: count },
  );

  // ---- Record.clone() ----

  suite.add(
    "Record.clone — 10K records",
    () => {
      for (const rec of mediumRecs) {
        rec.clone();
      }
    },
    { iterations: 5, recordCount: count },
  );

  // ---- Record.fromJSON() ----

  const jsonLines = mediumRecs.map((r) => r.toString());
  const totalBytes = Buffer.byteLength(jsonLines.join("\n"), "utf-8");

  suite.add(
    "Record.fromJSON — 10K lines",
    () => {
      for (const line of jsonLines) {
        Record.fromJSON(line);
      }
    },
    { iterations: 10, recordCount: count, byteCount: totalBytes },
  );

  // ---- Record.dataRef() (zero-copy) vs toJSON() (shallow copy) ----

  suite.add(
    "Record.dataRef — 10K records (zero-copy)",
    () => {
      for (const rec of mediumRecs) {
        rec.dataRef();
      }
    },
    { iterations: 20, recordCount: count },
  );

  // ---- Record.sort ----

  suite.add(
    "Record.sort — 10K records (numeric field)",
    () => {
      const recs = mediumData.map((d) => new Record(d));
      Record.sort(recs, "score=numeric");
    },
    { iterations: 5, recordCount: count },
  );

  suite.add(
    "Record.sort — 10K records (lexical field)",
    () => {
      const recs = mediumData.map((d) => new Record(d));
      Record.sort(recs, "name");
    },
    { iterations: 5, recordCount: count },
  );

  // ---- Record.cmp ----

  const recA = mediumRecs[0]!;
  const recB = mediumRecs[1]!;

  suite.add(
    "Record.cmp — 1M comparisons (single field)",
    () => {
      for (let i = 0; i < 1_000_000; i++) {
        recA.cmp(recB, "score=numeric");
      }
    },
    { iterations: 5, recordCount: 1_000_000 },
  );

  // ---- Record.sort with nested field ----

  const nestedData = mediumData.map((d) => ({ info: d }));

  suite.add(
    "Record.sort — 10K records (nested field numeric)",
    () => {
      const recs = nestedData.map((d) => new Record(d));
      Record.sort(recs, "info/score=numeric");
    },
    { iterations: 5, recordCount: count },
  );

  // ---- Record.cmp with multi-field spec ----

  suite.add(
    "Record.cmp — 1M comparisons (multi-field cached)",
    () => {
      for (let i = 0; i < 1_000_000; i++) {
        recA.cmp(recB, "name", "score=numeric");
      }
    },
    { iterations: 5, recordCount: 1_000_000 },
  );

  // ---- Record.sort with pre-warmed cache vs cold cache ----

  suite.add(
    "Record.sort — 10K records (cached comparator reuse)",
    () => {
      // Comparator is cached from previous benchmark runs
      const recs = mediumData.map((d) => new Record(d));
      Record.sort(recs, "score=numeric");
    },
    { iterations: 10, recordCount: count },
  );

  return suite;
}
