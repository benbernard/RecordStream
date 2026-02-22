/**
 * Benchmark: JSON parsing / InputStream throughput
 *
 * Measures how fast RecordStream can parse JSONL input into Record objects.
 */

import { BenchmarkSuite } from "../bench.ts";
import { Record } from "../../../src/Record.ts";
import { InputStream } from "../../../src/InputStream.ts";
import {
  generateJsonlString,
  generateRecords,
  SIZES,
} from "../fixtures.ts";

export function createJsonParsingSuite(filter?: string): BenchmarkSuite {
  const suite = new BenchmarkSuite("JSON Parsing", { filter });

  // ---- Record.fromJSON on raw lines ----

  const smallJsonl = generateJsonlString(SIZES.small);
  const smallLines = smallJsonl.trim().split("\n");
  suite.add(
    "Record.fromJSON — 100 lines",
    () => {
      for (const line of smallLines) {
        Record.fromJSON(line);
      }
    },
    { iterations: 50, recordCount: SIZES.small },
  );

  const mediumJsonl = generateJsonlString(SIZES.medium);
  const mediumLines = mediumJsonl.trim().split("\n");
  const mediumBytes = Buffer.byteLength(mediumJsonl, "utf-8");
  suite.add(
    "Record.fromJSON — 10K lines",
    () => {
      for (const line of mediumLines) {
        Record.fromJSON(line);
      }
    },
    { iterations: 10, recordCount: SIZES.medium, byteCount: mediumBytes },
  );

  // ---- InputStream.fromString ----

  suite.add(
    "InputStream.fromString — 100 records",
    async () => {
      const stream = InputStream.fromString(smallJsonl);
      let count = 0;
      for await (const _rec of stream) {
        count++;
      }
      if (count !== SIZES.small) throw new Error(`Expected ${SIZES.small}, got ${count}`);
    },
    { iterations: 50, recordCount: SIZES.small },
  );

  suite.add(
    "InputStream.fromString — 10K records",
    async () => {
      const stream = InputStream.fromString(mediumJsonl);
      let count = 0;
      for await (const _rec of stream) {
        count++;
      }
      if (count !== SIZES.medium) throw new Error(`Expected ${SIZES.medium}, got ${count}`);
    },
    { iterations: 10, recordCount: SIZES.medium, byteCount: mediumBytes },
  );

  // ---- JSON.parse baseline (no Record wrapping) ----

  suite.add(
    "JSON.parse baseline — 10K lines (no Record)",
    () => {
      for (const line of mediumLines) {
        JSON.parse(line) as unknown;
      }
    },
    { iterations: 10, recordCount: SIZES.medium, byteCount: mediumBytes },
  );

  // ---- Bulk parse comparison: line-by-line vs JSON.parse of array ----

  const mediumRecords = generateRecords(SIZES.medium);
  const jsonArray = JSON.stringify(mediumRecords);
  const jsonArrayBytes = Buffer.byteLength(jsonArray, "utf-8");
  suite.add(
    "JSON.parse single array — 10K records",
    () => {
      JSON.parse(jsonArray) as unknown;
    },
    { iterations: 10, recordCount: SIZES.medium, byteCount: jsonArrayBytes },
  );

  return suite;
}
