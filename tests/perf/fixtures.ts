/**
 * Test data fixture generator for performance benchmarks.
 *
 * Generates JSONL and CSV fixtures at three sizes:
 *   - small:  100 records
 *   - medium: 10,000 records
 *   - large:  1,000,000 records
 *
 * Records have varied field types: strings, numbers, nested objects, arrays.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { JsonObject } from "../../src/types/json.ts";

// ---------------------------------------------------------------------------
// Fixture directory
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(import.meta.dir, "fixtures");

export function fixtureDir(): string {
  return FIXTURE_DIR;
}

export function fixturePath(name: string): string {
  return join(FIXTURE_DIR, name);
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (xorshift32) — repeatable across runs
// ---------------------------------------------------------------------------

function xorshift32(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

// ---------------------------------------------------------------------------
// Record generation
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank",
  "Iris", "Jack", "Kate", "Liam", "Mia", "Noah", "Olivia", "Pat",
];

const CITIES = [
  "New York", "London", "Tokyo", "Paris", "Berlin", "Sydney",
  "Toronto", "Mumbai", "Beijing", "Lagos", "Cairo", "Lima",
];

const TAGS = [
  "alpha", "beta", "gamma", "delta", "epsilon", "zeta",
  "eta", "theta", "iota", "kappa",
];

function pick<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function generateRecord(index: number, rand: () => number): JsonObject {
  const tagCount = 1 + Math.floor(rand() * 4);
  const tags: string[] = [];
  for (let i = 0; i < tagCount; i++) {
    tags.push(pick(TAGS, rand));
  }

  return {
    id: index,
    name: pick(FIRST_NAMES, rand),
    age: 18 + Math.floor(rand() * 60),
    score: Math.round(rand() * 10000) / 100,
    active: rand() > 0.3,
    city: pick(CITIES, rand),
    tags,
    address: {
      street: `${Math.floor(rand() * 9999) + 1} Main St`,
      zip: String(10000 + Math.floor(rand() * 89999)),
      coords: {
        lat: -90 + rand() * 180,
        lng: -180 + rand() * 360,
      },
    },
    metrics: {
      views: Math.floor(rand() * 100000),
      clicks: Math.floor(rand() * 10000),
      ratio: Math.round(rand() * 1000) / 1000,
    },
    timestamp: new Date(
      2020 + Math.floor(rand() * 5),
      Math.floor(rand() * 12),
      1 + Math.floor(rand() * 28),
    ).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// JSONL generation
// ---------------------------------------------------------------------------

function generateJsonl(count: number, seed: number): string {
  const rand = xorshift32(seed);
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(JSON.stringify(generateRecord(i, rand)));
  }
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// CSV generation (flat fields only, for fromcsv benchmarks)
// ---------------------------------------------------------------------------

function generateCsv(count: number, seed: number): string {
  const rand = xorshift32(seed);
  const header = "id,name,age,score,active,city,views,clicks,timestamp";
  const lines = [header];
  for (let i = 0; i < count; i++) {
    const rec = generateRecord(i, rand);
    const metrics = rec["metrics"] as JsonObject;
    lines.push([
      rec["id"],
      rec["name"],
      rec["age"],
      rec["score"],
      rec["active"],
      `"${rec["city"] as string}"`,
      metrics["views"],
      metrics["clicks"],
      rec["timestamp"],
    ].join(","));
  }
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// In-memory record arrays (for benchmarks that don't need disk I/O)
// ---------------------------------------------------------------------------

export function generateRecords(count: number, seed = 42): JsonObject[] {
  const rand = xorshift32(seed);
  const records: JsonObject[] = [];
  for (let i = 0; i < count; i++) {
    records.push(generateRecord(i, rand));
  }
  return records;
}

export function generateJsonlString(count: number, seed = 42): string {
  return generateJsonl(count, seed);
}

export function generateCsvString(count: number, seed = 42): string {
  return generateCsv(count, seed);
}

// ---------------------------------------------------------------------------
// Fixture sizes
// ---------------------------------------------------------------------------

export const SIZES = {
  small: 100,
  medium: 10_000,
  large: 1_000_000,
} as const;

export type FixtureSize = keyof typeof SIZES;

// ---------------------------------------------------------------------------
// Ensure fixtures exist on disk (creates if missing)
// ---------------------------------------------------------------------------

export function ensureFixtures(sizes?: FixtureSize[]): void {
  const wanted = sizes ?? (["small", "medium"] as FixtureSize[]);

  if (!existsSync(FIXTURE_DIR)) {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  }

  for (const size of wanted) {
    const count = SIZES[size];
    const jsonlPath = fixturePath(`${size}.jsonl`);
    const csvPath = fixturePath(`${size}.csv`);

    if (!existsSync(jsonlPath)) {
      console.log(`Generating ${size} JSONL fixture (${count} records)...`);
      writeFileSync(jsonlPath, generateJsonl(count, 42));
    }

    if (!existsSync(csvPath)) {
      console.log(`Generating ${size} CSV fixture (${count} records)...`);
      writeFileSync(csvPath, generateCsv(count, 42));
    }
  }
}

/**
 * Return the byte size of a fixture file.
 */
export function fixtureByteSize(name: string): number {
  const path = fixturePath(name);
  if (!existsSync(path)) return 0;
  const stat = Bun.file(path);
  return stat.size;
}
