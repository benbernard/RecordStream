/**
 * CacheManager — LRU cache with configurable memory limit, cascading
 * invalidation, cache policies, and disk spill for large results.
 *
 * Sits between the executor and the PipelineState.cache map, providing
 * intelligent eviction, SHA-256 key computation, and policy enforcement.
 */

import { createHash } from "node:crypto";
import { writeFileSync, readFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  CachedResult,
  CacheConfig,
  CacheKey,
  StageId,
  InputId,
  Stage,
  Fork,
} from "../model/types.ts";
import type { Record } from "../../Record.ts";

/** Default memory limit: 512 MB */
const DEFAULT_MAX_MEMORY_BYTES = 512 * 1024 * 1024;

/** Threshold for disk spill: results larger than 50 MB are spilled to disk */
const SPILL_THRESHOLD_BYTES = 50 * 1024 * 1024;

/** Access metadata tracked per cache entry for LRU eviction. */
interface CacheEntry {
  result: CachedResult;
  /** Monotonic access counter for LRU ordering (avoids Date.now() precision issues). */
  accessOrder: number;
}

export class CacheManager {
  entries = new Map<string, CacheEntry>();
  currentSizeBytes = 0;
  maxMemoryBytes: number;
  cachePolicy: CacheConfig["cachePolicy"];
  pinnedStageIds: Set<StageId>;
  spillDir: string | null;
  accessCounter = 0;

  constructor(config: CacheConfig, spillDir?: string) {
    this.maxMemoryBytes = config.maxMemoryBytes || DEFAULT_MAX_MEMORY_BYTES;
    this.cachePolicy = config.cachePolicy;
    this.pinnedStageIds = new Set(config.pinnedStageIds);
    this.spillDir = spillDir ?? null;
  }

  // ── Configuration ──────────────────────────────────────────────

  updateConfig(config: CacheConfig): void {
    this.maxMemoryBytes = config.maxMemoryBytes || DEFAULT_MAX_MEMORY_BYTES;
    this.cachePolicy = config.cachePolicy;
    this.pinnedStageIds = new Set(config.pinnedStageIds);

    // If policy changed to "none", clear all entries
    if (this.cachePolicy === "none") {
      this.clear();
    }
  }

  // ── Cache Key Computation ──────────────────────────────────────

  /**
   * Compute a SHA-256 cache key for a stage given its position in the pipeline.
   *
   * Key = sha256(inputId + parentCacheKey + operationName + JSON(args) + enabled)
   *
   * This ensures that any change to an upstream stage produces a different
   * cache key for all downstream stages (cascading invalidation by key mismatch).
   */
  computeCacheKey(
    inputId: InputId,
    stages: Stage[],
    targetIndex: number,
  ): CacheKey {
    let parentKey = inputId;

    for (let i = 0; i <= targetIndex; i++) {
      const stage = stages[i]!;
      const data = [
        parentKey,
        stage.config.operationName,
        JSON.stringify(stage.config.args),
        String(stage.config.enabled),
      ].join("|");

      parentKey = createHash("sha256").update(data).digest("hex").slice(0, 16);
    }

    return parentKey;
  }

  // ── Get / Put / Has ────────────────────────────────────────────

  /**
   * Retrieve a cached result by composite key (inputId:stageId).
   * Updates the LRU access time on hit.
   */
  get(inputId: InputId, stageId: StageId): CachedResult | undefined {
    const key = compositeKey(inputId, stageId);
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    // Load spilled records from disk if needed
    if (entry.result.spillFile && entry.result.records.length === 0) {
      try {
        const content = readFileSync(entry.result.spillFile, "utf-8");
        const lines = content.split("\n").filter((l) => l.length > 0);
        entry.result = {
          ...entry.result,
          records: lines.map((l) => JSON.parse(l)) as Record[],
        };
      } catch {
        // Spill file missing or corrupt — treat as cache miss
        this.entries.delete(key);
        return undefined;
      }
    }

    entry.accessOrder = ++this.accessCounter;
    return entry.result;
  }

  /**
   * Check if a cache entry exists without updating LRU metadata.
   */
  has(inputId: InputId, stageId: StageId): boolean {
    return this.entries.has(compositeKey(inputId, stageId));
  }

  /**
   * Store a cached result. Respects cache policy, handles disk spill
   * for large results, and triggers LRU eviction if memory limit is exceeded.
   */
  put(result: CachedResult): void {
    if (!this.shouldCache(result.stageId)) return;

    const key = compositeKey(result.inputId, result.stageId);

    // Remove existing entry if replacing (reclaim its size)
    if (this.entries.has(key)) {
      this.evictEntry(key);
    }

    let storedResult = result;

    // Spill large results to disk
    if (result.sizeBytes > SPILL_THRESHOLD_BYTES && this.spillDir) {
      const spillFile = this.spillToDisk(key, result.records);
      if (spillFile) {
        storedResult = {
          ...result,
          spillFile,
          records: [], // Don't keep in memory
        };
      }
    }

    // Spilled entries don't count toward in-memory size
    const inMemorySize = storedResult.spillFile ? 0 : storedResult.sizeBytes;

    // Evict entries if needed to stay under memory limit
    while (
      this.currentSizeBytes + inMemorySize > this.maxMemoryBytes &&
      this.entries.size > 0
    ) {
      this.evictLRU();
    }

    this.entries.set(key, {
      result: storedResult,
      accessOrder: ++this.accessCounter,
    });
    this.currentSizeBytes += inMemorySize;
  }

  // ── Invalidation ───────────────────────────────────────────────

  /**
   * Invalidate a single stage's cache across all inputs.
   */
  invalidateStage(stageId: StageId): void {
    for (const [key, entry] of this.entries) {
      if (entry.result.stageId === stageId) {
        this.evictEntry(key);
      }
    }
  }

  /**
   * Cascading invalidation: invalidate a stage and all downstream stages
   * in the given fork. Called when a stage's config changes.
   */
  invalidateCascade(
    stageId: StageId,
    forks: Map<string, Fork>,
    stages: Map<string, Stage>,
  ): void {
    const stage = stages.get(stageId);
    if (!stage) return;

    const fork = forks.get(stage.forkId);
    if (!fork) return;

    const idx = fork.stageIds.indexOf(stageId);
    if (idx === -1) return;

    // Invalidate this stage + all stages after it in the fork
    const toInvalidate = new Set(fork.stageIds.slice(idx));

    for (const [key, entry] of this.entries) {
      if (toInvalidate.has(entry.result.stageId)) {
        this.evictEntry(key);
      }
    }
  }

  // ── Bulk Operations ────────────────────────────────────────────

  /**
   * Clear all cache entries and reclaim memory.
   */
  clear(): void {
    for (const [, entry] of this.entries) {
      this.cleanupSpillFile(entry.result.spillFile);
    }
    this.entries.clear();
    this.currentSizeBytes = 0;
  }

  /**
   * Get all cached entries as a flat Map (for serialization / state sync).
   */
  toMap(): Map<string, CachedResult> {
    const map = new Map<string, CachedResult>();
    for (const [key, entry] of this.entries) {
      map.set(key, entry.result);
    }
    return map;
  }

  /**
   * Restore cache from a state Map (e.g., after session load).
   */
  fromMap(map: Map<string, CachedResult>): void {
    this.clear();
    for (const [_key, result] of map) {
      this.put(result);
    }
  }

  // ── Stats ──────────────────────────────────────────────────────

  get size(): number {
    return this.entries.size;
  }

  get memoryUsageBytes(): number {
    return this.currentSizeBytes;
  }

  /** Expose the spill threshold for testing */
  static get SPILL_THRESHOLD_BYTES(): number {
    return SPILL_THRESHOLD_BYTES;
  }

  // ── Internal Methods ───────────────────────────────────────────

  /**
   * Check if a stage should be cached under the current policy.
   */
  shouldCache(stageId: StageId): boolean {
    switch (this.cachePolicy) {
      case "none":
        return false;
      case "selective":
        return this.pinnedStageIds.has(stageId);
      case "all":
        return true;
    }
  }

  /**
   * Evict the least-recently-used entry.
   */
  evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestOrder = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.accessOrder < oldestOrder) {
        oldestOrder = entry.accessOrder;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.evictEntry(oldestKey);
    }
  }

  /**
   * Remove a specific entry by key, reclaiming its memory.
   */
  evictEntry(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;

    const inMemorySize = entry.result.spillFile ? 0 : entry.result.sizeBytes;
    this.currentSizeBytes -= inMemorySize;
    this.cleanupSpillFile(entry.result.spillFile);
    this.entries.delete(key);
  }

  /**
   * Write records to a JSONL file on disk, returning the file path.
   */
  spillToDisk(key: string, records: Record[]): string | null {
    if (!this.spillDir) return null;

    try {
      mkdirSync(this.spillDir, { recursive: true });
      const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
      const path = join(this.spillDir, `${safeKey}.jsonl`);
      const content = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
      writeFileSync(path, content, "utf-8");
      return path;
    } catch {
      return null;
    }
  }

  /**
   * Remove a spill file from disk if it exists.
   */
  cleanupSpillFile(spillFile: string | null): void {
    if (!spillFile) return;
    try {
      if (existsSync(spillFile)) {
        unlinkSync(spillFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Build a composite cache key from inputId and stageId.
 */
function compositeKey(inputId: InputId, stageId: StageId): string {
  return `${inputId}:${stageId}`;
}
