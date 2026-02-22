/**
 * Benchmark: JSON serialization / OutputStream throughput
 *
 * Measures how fast RecordStream can serialize Record objects to JSONL.
 */

import { BenchmarkSuite } from "../bench.ts";
import { Record } from "../../../src/Record.ts";
import { generateRecords, SIZES } from "../fixtures.ts";

export function createJsonSerializationSuite(filter?: string): BenchmarkSuite {
  const suite = new BenchmarkSuite("JSON Serialization", { filter });

  // Pre-build Record objects
  const smallRecords = generateRecords(SIZES.small).map((d) => new Record(d));
  const mediumRecords = generateRecords(SIZES.medium).map((d) => new Record(d));

  // ---- Record.toString() ----

  suite.add(
    "Record.toString — 100 records",
    () => {
      for (const rec of smallRecords) {
        rec.toString();
      }
    },
    { iterations: 50, recordCount: SIZES.small },
  );

  // Estimate byte size once
  const mediumOutput = mediumRecords.map((r) => r.toString()).join("\n");
  const mediumBytes = Buffer.byteLength(mediumOutput, "utf-8");

  suite.add(
    "Record.toString — 10K records",
    () => {
      for (const rec of mediumRecords) {
        rec.toString();
      }
    },
    { iterations: 10, recordCount: SIZES.medium, byteCount: mediumBytes },
  );

  // ---- Record.toJSON() ----

  suite.add(
    "Record.toJSON — 10K records",
    () => {
      for (const rec of mediumRecords) {
        rec.toJSON();
      }
    },
    { iterations: 10, recordCount: SIZES.medium },
  );

  // ---- JSON.stringify baseline (no Record wrapping) ----

  const mediumData = generateRecords(SIZES.medium);
  suite.add(
    "JSON.stringify baseline — 10K objects (no Record)",
    () => {
      for (const obj of mediumData) {
        JSON.stringify(obj);
      }
    },
    { iterations: 10, recordCount: SIZES.medium, byteCount: mediumBytes },
  );

  // ---- Batch serialization: join lines vs write individually ----

  suite.add(
    "Batch join — 10K records (map+join)",
    () => {
      mediumRecords.map((r) => r.toString()).join("\n");
    },
    { iterations: 10, recordCount: SIZES.medium, byteCount: mediumBytes },
  );

  return suite;
}
