#!/usr/bin/env bun
/**
 * Benchmark script for explorer executor performance.
 * Measures time spent in key operations: clone, estimateSize, LRU eviction,
 * cascade invalidation, and disk spill.
 */

import "../src/cli/dispatcher.ts";

import { Record } from "../src/Record.ts";
import { InterceptReceiver } from "../src/explorer/executor/intercept-receiver.ts";
import { CacheManager } from "../src/explorer/executor/cache-manager.ts";
import { executeToStage } from "../src/explorer/executor/executor.ts";
import type {
  PipelineState,
  Stage,
  InputSource,
  CacheConfig,
  CachedResult,
  Fork,
  InspectorState,
} from "../src/explorer/model/types.ts";
import { rmSync, existsSync } from "node:fs";

// ── Helpers ─────────────────────────────────────────────────────────

function generateRecords(count: number, fieldsPerRecord: number): Record[] {
  const records: Record[] = [];
  for (let i = 0; i < count; i++) {
    const data: { [key: string]: unknown } = { id: i, name: `user_${i}` };
    for (let f = 0; f < fieldsPerRecord; f++) {
      data[`field_${f}`] = `value_${i}_${f}_${"x".repeat(50)}`;
    }
    records.push(new Record(data as any));
  }
  return records;
}

function makeStage(
  id: string,
  opName: string,
  args: string[],
  parentId: string | null,
  position: number,
): Stage {
  return {
    id,
    config: { operationName: opName, args, enabled: true },
    parentId,
    childIds: [],
    forkId: "main",
    position,
  };
}

function makePipelineState(
  stages: Stage[],
  input: InputSource,
): PipelineState {
  const stageMap = new Map<string, Stage>();
  for (const s of stages) stageMap.set(s.id, s);
  for (const s of stages) {
    if (s.parentId) {
      const parent = stageMap.get(s.parentId);
      if (parent && !parent.childIds.includes(s.id)) parent.childIds.push(s.id);
    }
  }
  const cacheConfig: CacheConfig = {
    maxMemoryBytes: 512 * 1024 * 1024,
    cachePolicy: "all",
    pinnedStageIds: new Set(),
  };
  const inspector: InspectorState = {
    viewMode: "table",
    scrollOffset: 0,
    searchQuery: null,
    highlightedColumn: null,
  };
  return {
    stages: stageMap,
    forks: new Map([["main", {
      id: "main", name: "main", forkPointStageId: null,
      parentForkId: null, stageIds: stages.map((s) => s.id), createdAt: Date.now(),
    }]]),
    inputs: new Map([[input.id, input]]),
    activeInputId: input.id,
    activeForkId: "main",
    cursorStageId: stages[stages.length - 1]?.id ?? null,
    focusedPanel: "pipeline",
    cache: new Map(),
    cacheConfig,
    inspector,
    executing: false,
    lastError: null,
    undoStack: [],
    redoStack: [],
    sessionId: "bench",
    sessionDir: "/tmp/recs-bench",
  };
}

function makeCachedResult(inputId: string, stageId: string, sizeBytes: number): CachedResult {
  return {
    key: `${inputId}:${stageId}`,
    stageId, inputId, records: [], spillFile: null,
    recordCount: 10, fieldNames: ["a", "b"],
    computedAt: Date.now(), sizeBytes, computeTimeMs: 1,
  };
}

function bench(label: string, fn: () => void, iterations = 1): number {
  // Warmup
  for (let i = 0; i < Math.min(3, iterations); i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const perIter = elapsed / iterations;
  console.log(`  ${label}: ${elapsed.toFixed(1)}ms total (${perIter.toFixed(3)}ms/iter, ${iterations} iters)`);
  return elapsed;
}

async function benchAsync(label: string, fn: () => Promise<void>, iterations = 1): Promise<number> {
  for (let i = 0; i < Math.min(3, iterations); i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const perIter = elapsed / iterations;
  console.log(`  ${label}: ${elapsed.toFixed(1)}ms total (${perIter.toFixed(3)}ms/iter, ${iterations} iters)`);
  return elapsed;
}

// ── Benchmarks ──────────────────────────────────────────────────────

const RECORD_COUNTS = [1000, 5000, 10000];

console.log("=== Explorer Executor Performance Benchmark ===\n");

// 1. InterceptReceiver.acceptRecord (clone cost)
console.log("--- 1. InterceptReceiver clone() cost ---");
for (const count of RECORD_COUNTS) {
  const records = generateRecords(count, 5);
  bench(`InterceptReceiver ${count} records (with clone)`, () => {
    const receiver = new InterceptReceiver();
    for (const r of records) receiver.acceptRecord(r);
  }, 5);
}

// 1b. Baseline: without clone (push only)
console.log("\n--- 1b. Baseline: push without clone ---");
for (const count of RECORD_COUNTS) {
  const records = generateRecords(count, 5);
  bench(`Push-only ${count} records (no clone)`, () => {
    const arr: Record[] = [];
    const fieldNames = new Set<string>();
    for (const r of records) {
      for (const key of r.keys()) fieldNames.add(key);
      arr.push(r);
    }
  }, 5);
}

// 2. estimateSize cost
console.log("\n--- 2. estimateSize() cost (JSON.stringify every record) ---");
for (const count of RECORD_COUNTS) {
  const records = generateRecords(count, 5);
  bench(`estimateSize ${count} records (toString per record)`, () => {
    let _size = 0;
    for (const r of records) _size += r.toString().length * 2;
  }, 5);
}

// 2b. Alternative: rough estimate from record count
console.log("\n--- 2b. Alternative estimateSize (sampling) ---");
for (const count of RECORD_COUNTS) {
  const records = generateRecords(count, 5);
  bench(`estimateSize-sampling ${count} records`, () => {
    if (records.length === 0) return;
    const sampleSize = Math.min(10, records.length);
    let sampleTotal = 0;
    for (let i = 0; i < sampleSize; i++) {
      sampleTotal += records[i]!.toString().length * 2;
    }
    void ((sampleTotal / sampleSize) * records.length);
  }, 5);
}

// 3. LRU eviction with many cache entries
console.log("\n--- 3. LRU eviction O(n) scan ---");
for (const entryCount of [100, 500, 1000]) {
  const config: CacheConfig = {
    maxMemoryBytes: entryCount * 1000 + 500,
    cachePolicy: "all",
    pinnedStageIds: new Set(),
  };
  bench(`LRU eviction with ${entryCount} entries`, () => {
    const mgr = new CacheManager(config);
    for (let i = 0; i < entryCount; i++) {
      mgr.put(makeCachedResult("in1", `s${i}`, 1000));
    }
    // Trigger an eviction
    mgr.put(makeCachedResult("in1", "trigger", 1000));
  }, 10);
}

// 4. Cascade invalidation with many entries
console.log("\n--- 4. Cascade invalidation ---");
for (const stageCount of [20, 50, 100]) {
  const stageIds = Array.from({ length: stageCount }, (_, i) => `s${i}`);
  const stages = new Map<string, Stage>();
  for (let i = 0; i < stageCount; i++) {
    stages.set(stageIds[i]!, makeStage(stageIds[i]!, "grep", [], i === 0 ? null : stageIds[i - 1]!, i));
  }
  const forks = new Map<string, Fork>([
    ["main", { id: "main", name: "main", forkPointStageId: null, parentForkId: null, stageIds, createdAt: Date.now() }],
  ]);
  const config: CacheConfig = {
    maxMemoryBytes: 512 * 1024 * 1024,
    cachePolicy: "all",
    pinnedStageIds: new Set(),
  };

  bench(`Cascade invalidation ${stageCount} stages (from middle)`, () => {
    const mgr = new CacheManager(config);
    for (let i = 0; i < stageCount; i++) {
      mgr.put(makeCachedResult("in1", stageIds[i]!, 1000));
    }
    // Invalidate from the middle
    mgr.invalidateCascade(stageIds[Math.floor(stageCount / 2)]!, forks, stages);
  }, 20);
}

// 5. Disk spill (synchronous I/O)
console.log("\n--- 5. Disk spill (sync writeFileSync) ---");
const spillDir = "/tmp/recs-bench-spill";
for (const count of [100, 1000, 5000]) {
  const records = generateRecords(count, 5);
  bench(`spillToDisk ${count} records`, () => {
    const mgr = new CacheManager(
      { maxMemoryBytes: 512 * 1024 * 1024, cachePolicy: "all", pinnedStageIds: new Set() },
      spillDir,
    );
    mgr.spillToDisk("bench-key", records as any);
  }, 5);
}
if (existsSync(spillDir)) rmSync(spillDir, { recursive: true, force: true });

// 6. Full pipeline execution (end-to-end)
console.log("\n--- 6. Full pipeline execution (grep → sort → xform) ---");
for (const count of RECORD_COUNTS) {
  const inputRecords = generateRecords(count, 5);
  const input: InputSource = {
    id: "in1",
    source: { kind: "stdin-capture", records: inputRecords },
    label: "bench",
  };
  const stages = [
    makeStage("s1", "grep", ["{{id}} > 10"], null, 0),
    makeStage("s2", "sort", ["--key", "id=n"], "s1", 1),
    makeStage("s3", "xform", ["{{doubled}} = {{id}} * 2"], "s2", 2),
  ];

  await benchAsync(`Pipeline (3 stages) ${count} records`, async () => {
    const state = makePipelineState(stages, input);
    await executeToStage(state, "s3");
  }, 3);
}

// 7. SHA-256 cache key computation
console.log("\n--- 7. SHA-256 cache key computation ---");
for (const depth of [5, 10, 20]) {
  const stageArr: Stage[] = [];
  for (let i = 0; i < depth; i++) {
    stageArr.push(makeStage(`s${i}`, "grep", [`{{id}} > ${i}`], i === 0 ? null : `s${i - 1}`, i));
  }
  const config: CacheConfig = {
    maxMemoryBytes: 512 * 1024 * 1024,
    cachePolicy: "all",
    pinnedStageIds: new Set(),
  };
  const mgr = new CacheManager(config);

  bench(`computeCacheKey depth=${depth}`, () => {
    mgr.computeCacheKey("in1", stageArr, depth - 1);
  }, 100);
}

console.log("\n=== Benchmark Complete ===");
