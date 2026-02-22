/**
 * Benchmark: KeySpec access patterns
 *
 * Measures the cost of resolving simple keys, nested keys (foo/bar/baz),
 * array indexing, and fuzzy matching.
 */

import { BenchmarkSuite } from "../bench.ts";
import { KeySpec, findKey, clearKeySpecCaches } from "../../../src/KeySpec.ts";
import { generateRecords, SIZES } from "../fixtures.ts";
import type { JsonObject } from "../../../src/types/json.ts";

export function createKeySpecSuite(filter?: string): BenchmarkSuite {
  const suite = new BenchmarkSuite("KeySpec Access", { filter });

  const records = generateRecords(SIZES.medium);
  const count = records.length;

  // ---- Simple top-level key ----

  suite.add(
    "KeySpec — simple key (name)",
    () => {
      for (const rec of records) {
        findKey(rec, "name", true);
      }
    },
    { iterations: 10, recordCount: count },
  );

  // ---- Nested key (2 levels) ----

  suite.add(
    "KeySpec — nested key (address/zip)",
    () => {
      for (const rec of records) {
        findKey(rec, "address/zip", true);
      }
    },
    { iterations: 10, recordCount: count },
  );

  // ---- Deep nested key (3 levels) ----

  suite.add(
    "KeySpec — deep nested (address/coords/lat)",
    () => {
      for (const rec of records) {
        findKey(rec, "address/coords/lat", true);
      }
    },
    { iterations: 10, recordCount: count },
  );

  // ---- Array index access ----

  suite.add(
    "KeySpec — array index (tags/#0)",
    () => {
      for (const rec of records) {
        findKey(rec, "tags/#0", true);
      }
    },
    { iterations: 10, recordCount: count },
  );

  // ---- Direct property access baseline ----

  suite.add(
    "Direct property access baseline (rec['name'])",
    () => {
      for (const rec of records) {
        void rec["name"];
      }
    },
    { iterations: 10, recordCount: count },
  );

  // ---- Direct nested access baseline ----

  suite.add(
    "Direct nested access baseline (rec.address.coords.lat)",
    () => {
      for (const rec of records) {
        const addr = rec["address"] as JsonObject | undefined;
        if (addr) {
          const coords = addr["coords"] as JsonObject | undefined;
          if (coords) {
            void coords["lat"];
          }
        }
      }
    },
    { iterations: 10, recordCount: count },
  );

  // ---- KeySpec construction (cached vs uncached) ----

  suite.add(
    "KeySpec construction — cached (same spec 10K times)",
    () => {
      for (let i = 0; i < count; i++) {
        new KeySpec("address/coords/lat");
      }
    },
    { iterations: 10, recordCount: count },
  );

  suite.add(
    "KeySpec construction — unique specs (10K different)",
    () => {
      clearKeySpecCaches();
      for (let i = 0; i < count; i++) {
        new KeySpec(`field_${i}`);
      }
      clearKeySpecCaches();
    },
    { iterations: 5, recordCount: count },
  );

  // ---- Compiled accessor benchmarks ----

  const nestedSpec = new KeySpec("address/zip");
  suite.add(
    "Compiled KeySpec.resolveValue — nested (address/zip)",
    () => {
      for (const rec of records) {
        nestedSpec.resolveValue(rec);
      }
    },
    { iterations: 10, recordCount: count },
  );

  const deepSpec = new KeySpec("address/coords/lat");
  suite.add(
    "Compiled KeySpec.resolveValue — deep (address/coords/lat)",
    () => {
      for (const rec of records) {
        deepSpec.resolveValue(rec);
      }
    },
    { iterations: 10, recordCount: count },
  );

  const arraySpec = new KeySpec("tags/#0");
  suite.add(
    "Compiled KeySpec.resolveValue — array (tags/#0)",
    () => {
      for (const rec of records) {
        arraySpec.resolveValue(rec);
      }
    },
    { iterations: 10, recordCount: count },
  );

  const setSpec = new KeySpec("address/zip");
  suite.add(
    "Compiled KeySpec.setValue — nested (address/zip)",
    () => {
      for (const rec of records) {
        setSpec.setValue(rec, 99999);
      }
    },
    { iterations: 10, recordCount: count },
  );

  return suite;
}
