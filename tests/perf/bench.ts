/**
 * Core benchmark harness for RecordStream.
 *
 * Provides high-resolution timing, statistical reporting (min/median/p95/max),
 * throughput measurement (records/sec, MB/sec), warmup runs, and optional
 * baseline comparison.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkResult {
  name: string;
  iterations: number;
  timings: number[]; // ms per iteration
  min: number;
  median: number;
  p95: number;
  max: number;
  mean: number;
  /** records processed per second (if applicable) */
  recordsPerSec?: number;
  /** megabytes processed per second (if applicable) */
  mbPerSec?: number;
}

export interface BenchmarkOptions {
  /** Number of warmup iterations (default: 3) */
  warmup?: number;
  /** Number of timed iterations (default: 10) */
  iterations?: number;
  /** Total records processed per iteration (for throughput calc) */
  recordCount?: number;
  /** Total bytes processed per iteration (for throughput calc) */
  byteCount?: number;
}

export interface SuiteOptions {
  /** Only run benchmarks whose name matches this filter */
  filter?: string;
}

interface BenchEntry {
  name: string;
  fn: () => void | Promise<void>;
  options: BenchmarkOptions;
}

// ---------------------------------------------------------------------------
// Timer helper — prefer Bun.nanoseconds when available
// ---------------------------------------------------------------------------

function nowMs(): number {
  if (typeof Bun !== "undefined" && typeof Bun.nanoseconds === "function") {
    return Bun.nanoseconds() / 1e6;
  }
  return performance.now();
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function computeMedian(sorted: number[]): number {
  return percentile(sorted, 50);
}

// ---------------------------------------------------------------------------
// Baseline I/O
// ---------------------------------------------------------------------------

const BASELINE_DIR = join(import.meta.dir, "fixtures");
const BASELINE_FILE = join(BASELINE_DIR, "baseline.json");

interface BaselineData {
  [benchName: string]: { median: number; mean: number };
}

function loadBaseline(): BaselineData | null {
  try {
    if (existsSync(BASELINE_FILE)) {
      return JSON.parse(readFileSync(BASELINE_FILE, "utf-8")) as BaselineData;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveBaseline(results: BenchmarkResult[]): void {
  const data: BaselineData = {};
  for (const r of results) {
    data[r.name] = { median: r.median, mean: r.mean };
  }
  if (!existsSync(BASELINE_DIR)) {
    mkdirSync(BASELINE_DIR, { recursive: true });
  }
  writeFileSync(BASELINE_FILE, JSON.stringify(data, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(1)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(3)}s`;
}

function fmtRate(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(0);
}

function fmtDelta(current: number, baseline: number): string {
  const pct = ((current - baseline) / baseline) * 100;
  const sign = pct > 0 ? "+" : "";
  const color = pct > 5 ? "\x1b[31m" : pct < -5 ? "\x1b[32m" : "\x1b[33m";
  return `${color}${sign}${pct.toFixed(1)}%\x1b[0m`;
}

// ---------------------------------------------------------------------------
// Suite runner
// ---------------------------------------------------------------------------

export class BenchmarkSuite {
  name: string;
  #entries: BenchEntry[] = [];
  #results: BenchmarkResult[] = [];
  #suiteOptions: SuiteOptions;

  constructor(name: string, options?: SuiteOptions) {
    this.name = name;
    this.#suiteOptions = options ?? {};
  }

  /**
   * Register a benchmark within this suite.
   */
  add(
    name: string,
    fn: () => void | Promise<void>,
    options?: BenchmarkOptions,
  ): void {
    this.#entries.push({ name, fn, options: options ?? {} });
  }

  /**
   * Run all registered benchmarks and print results.
   */
  async run(): Promise<BenchmarkResult[]> {
    const filter = this.#suiteOptions.filter;
    const entries = filter
      ? this.#entries.filter((e) => e.name.includes(filter))
      : this.#entries;

    if (entries.length === 0) {
      console.log(`\nSuite: ${this.name} — no benchmarks matched filter\n`);
      return [];
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(`Suite: ${this.name}`);
    console.log(`${"=".repeat(70)}`);

    const baseline = loadBaseline();

    for (const entry of entries) {
      const result = await this.#runOne(entry);
      this.#results.push(result);
      this.#printResult(result, baseline);
    }

    return this.#results;
  }

  async #runOne(entry: BenchEntry): Promise<BenchmarkResult> {
    const warmup = entry.options.warmup ?? 3;
    const iterations = entry.options.iterations ?? 10;

    // Warmup
    for (let i = 0; i < warmup; i++) {
      await entry.fn();
    }

    // Timed runs
    const timings: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = nowMs();
      await entry.fn();
      const elapsed = nowMs() - start;
      timings.push(elapsed);
    }

    const sorted = [...timings].sort((a, b) => a - b);
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    const med = computeMedian(sorted);
    const p95 = percentile(sorted, 95);
    const mean = timings.reduce((a, b) => a + b, 0) / timings.length;

    const result: BenchmarkResult = {
      name: entry.name,
      iterations,
      timings,
      min,
      median: med,
      p95,
      max,
      mean,
    };

    if (entry.options.recordCount) {
      result.recordsPerSec = entry.options.recordCount / (med / 1000);
    }
    if (entry.options.byteCount) {
      result.mbPerSec = (entry.options.byteCount / (1024 * 1024)) / (med / 1000);
    }

    return result;
  }

  #printResult(result: BenchmarkResult, baseline: BaselineData | null): void {
    const parts: string[] = [
      `  ${result.name}`,
      `    min=${fmtMs(result.min)}  median=${fmtMs(result.median)}  p95=${fmtMs(result.p95)}  max=${fmtMs(result.max)}`,
    ];

    const throughput: string[] = [];
    if (result.recordsPerSec) {
      throughput.push(`${fmtRate(result.recordsPerSec)} records/sec`);
    }
    if (result.mbPerSec) {
      throughput.push(`${result.mbPerSec.toFixed(2)} MB/sec`);
    }
    if (throughput.length > 0) {
      parts.push(`    throughput: ${throughput.join("  ")}`);
    }

    if (baseline && baseline[result.name]) {
      const base = baseline[result.name]!;
      parts.push(`    vs baseline: ${fmtDelta(result.median, base.median)}`);
    }

    console.log(parts.join("\n"));
  }

  /**
   * Save current results as the new baseline.
   */
  saveBaseline(): void {
    saveBaseline(this.#results);
    console.log(`\nBaseline saved to ${BASELINE_FILE}`);
  }

  getResults(): BenchmarkResult[] {
    return [...this.#results];
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

export async function runAllSuites(
  suites: BenchmarkSuite[],
  options?: { saveBaseline?: boolean },
): Promise<void> {
  console.log("RecordStream Performance Benchmarks");
  console.log(`Runtime: Bun ${typeof Bun !== "undefined" ? Bun.version : "N/A"}`);
  console.log(`Date: ${new Date().toISOString()}`);

  const allResults: BenchmarkResult[] = [];

  for (const suite of suites) {
    const results = await suite.run();
    allResults.push(...results);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`Total benchmarks: ${allResults.length}`);
  console.log(`${"=".repeat(70)}\n`);

  if (options?.saveBaseline) {
    saveBaseline(allResults);
    console.log(`Baseline saved to ${BASELINE_FILE}\n`);
  }
}
