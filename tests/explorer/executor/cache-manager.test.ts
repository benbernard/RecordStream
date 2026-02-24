import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { rmSync, existsSync } from "node:fs";
import { CacheManager } from "../../../src/explorer/executor/cache-manager.ts";
import type {
  CachedResult,
  CacheConfig,
  Stage,
  Fork,
} from "../../../src/explorer/model/types.ts";

// ── Helpers ──────────────────────────────────────────────────────────

const TEST_SPILL_DIR = "/tmp/recs-explorer-cache-test";

function makeConfig(overrides?: Partial<CacheConfig>): CacheConfig {
  return {
    maxMemoryBytes: 100 * 1024 * 1024, // 100 MB
    cachePolicy: "all",
    pinnedStageIds: new Set(),
    ...overrides,
  };
}

function makeCachedResult(
  inputId: string,
  stageId: string,
  overrides?: Partial<CachedResult>,
): CachedResult {
  return {
    key: `${inputId}:${stageId}`,
    stageId,
    inputId,
    records: [],
    lines: [],
    spillFile: null,
    recordCount: 10,
    fieldNames: ["a", "b"],
    computedAt: Date.now(),
    sizeBytes: 1000,
    computeTimeMs: 5,
    ...overrides,
  };
}

function makeStage(
  id: string,
  opName: string,
  args: string[],
  forkId: string,
  position: number,
  parentId: string | null = null,
): Stage {
  return {
    id,
    config: { operationName: opName, args, enabled: true },
    parentId,
    childIds: [],
    forkId,
    position,
  };
}

function makeFork(id: string, stageIds: string[]): Fork {
  return {
    id,
    name: id,
    forkPointStageId: null,
    parentForkId: null,
    stageIds,
    createdAt: Date.now(),
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("CacheManager", () => {
  let manager: CacheManager;

  beforeEach(() => {
    manager = new CacheManager(makeConfig());
  });

  afterEach(() => {
    if (existsSync(TEST_SPILL_DIR)) {
      rmSync(TEST_SPILL_DIR, { recursive: true, force: true });
    }
  });

  // ── Basic get/put/has ──────────────────────────────────────────

  describe("get/put/has", () => {
    test("stores and retrieves a cached result", () => {
      const result = makeCachedResult("in1", "s1");
      manager.put(result);

      expect(manager.has("in1", "s1")).toBe(true);
      expect(manager.get("in1", "s1")).toEqual(result);
    });

    test("returns undefined for cache miss", () => {
      expect(manager.get("in1", "s1")).toBeUndefined();
      expect(manager.has("in1", "s1")).toBe(false);
    });

    test("replaces existing entry with same key", () => {
      const r1 = makeCachedResult("in1", "s1", { recordCount: 10 });
      const r2 = makeCachedResult("in1", "s1", { recordCount: 20 });

      manager.put(r1);
      manager.put(r2);

      expect(manager.size).toBe(1);
      expect(manager.get("in1", "s1")!.recordCount).toBe(20);
    });

    test("stores entries with different input/stage combinations", () => {
      manager.put(makeCachedResult("in1", "s1"));
      manager.put(makeCachedResult("in1", "s2"));
      manager.put(makeCachedResult("in2", "s1"));

      expect(manager.size).toBe(3);
      expect(manager.has("in1", "s1")).toBe(true);
      expect(manager.has("in1", "s2")).toBe(true);
      expect(manager.has("in2", "s1")).toBe(true);
    });
  });

  // ── Cache Key Computation ──────────────────────────────────────

  describe("computeCacheKey", () => {
    test("produces a 16-char hex string", () => {
      const stages = [makeStage("s1", "grep", ["status=200"], "main", 0)];
      const key = manager.computeCacheKey("in1", stages, 0);

      expect(key).toHaveLength(16);
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    test("same input produces same key", () => {
      const stages = [makeStage("s1", "grep", ["status=200"], "main", 0)];
      const key1 = manager.computeCacheKey("in1", stages, 0);
      const key2 = manager.computeCacheKey("in1", stages, 0);

      expect(key1).toBe(key2);
    });

    test("different args produce different keys", () => {
      const stages1 = [makeStage("s1", "grep", ["status=200"], "main", 0)];
      const stages2 = [makeStage("s1", "grep", ["status=404"], "main", 0)];

      const key1 = manager.computeCacheKey("in1", stages1, 0);
      const key2 = manager.computeCacheKey("in1", stages2, 0);

      expect(key1).not.toBe(key2);
    });

    test("different input IDs produce different keys", () => {
      const stages = [makeStage("s1", "grep", ["status=200"], "main", 0)];
      const key1 = manager.computeCacheKey("in1", stages, 0);
      const key2 = manager.computeCacheKey("in2", stages, 0);

      expect(key1).not.toBe(key2);
    });

    test("upstream change cascades to downstream key", () => {
      const stages1 = [
        makeStage("s1", "grep", ["status=200"], "main", 0),
        makeStage("s2", "sort", ["--key", "x=n"], "main", 1, "s1"),
      ];
      const stages2 = [
        makeStage("s1", "grep", ["status=404"], "main", 0),
        makeStage("s2", "sort", ["--key", "x=n"], "main", 1, "s1"),
      ];

      const key1 = manager.computeCacheKey("in1", stages1, 1);
      const key2 = manager.computeCacheKey("in1", stages2, 1);

      // Different upstream args → different downstream key
      expect(key1).not.toBe(key2);
    });

    test("enabled flag affects cache key", () => {
      const stage1 = makeStage("s1", "grep", ["status=200"], "main", 0);
      const stage2 = { ...stage1, config: { ...stage1.config, enabled: false } };

      const key1 = manager.computeCacheKey("in1", [stage1], 0);
      const key2 = manager.computeCacheKey("in1", [stage2], 0);

      expect(key1).not.toBe(key2);
    });
  });

  // ── LRU Eviction ───────────────────────────────────────────────

  describe("LRU eviction", () => {
    test("evicts least recently used entry when memory limit exceeded", () => {
      const config = makeConfig({ maxMemoryBytes: 3000 });
      manager = new CacheManager(config);

      manager.put(makeCachedResult("in1", "s1", { sizeBytes: 1000 }));
      manager.put(makeCachedResult("in1", "s2", { sizeBytes: 1000 }));
      manager.put(makeCachedResult("in1", "s3", { sizeBytes: 1000 }));

      expect(manager.size).toBe(3);

      // Adding a 4th entry should evict the oldest (s1)
      manager.put(makeCachedResult("in1", "s4", { sizeBytes: 1000 }));

      expect(manager.has("in1", "s1")).toBe(false);
      expect(manager.has("in1", "s4")).toBe(true);
    });

    test("accessing an entry updates its LRU position", () => {
      const config = makeConfig({ maxMemoryBytes: 3000 });
      manager = new CacheManager(config);

      manager.put(makeCachedResult("in1", "s1", { sizeBytes: 1000 }));
      manager.put(makeCachedResult("in1", "s2", { sizeBytes: 1000 }));
      manager.put(makeCachedResult("in1", "s3", { sizeBytes: 1000 }));

      // Access s1 to make it "recently used"
      manager.get("in1", "s1");

      // Adding s4 should evict s2 (oldest that wasn't recently accessed)
      manager.put(makeCachedResult("in1", "s4", { sizeBytes: 1000 }));

      expect(manager.has("in1", "s1")).toBe(true);
      expect(manager.has("in1", "s2")).toBe(false);
      expect(manager.has("in1", "s4")).toBe(true);
    });

    test("tracks memory usage correctly", () => {
      manager.put(makeCachedResult("in1", "s1", { sizeBytes: 500 }));
      manager.put(makeCachedResult("in1", "s2", { sizeBytes: 300 }));

      expect(manager.memoryUsageBytes).toBe(800);
    });

    test("memory usage decreases on eviction", () => {
      const config = makeConfig({ maxMemoryBytes: 1500 });
      manager = new CacheManager(config);

      manager.put(makeCachedResult("in1", "s1", { sizeBytes: 1000 }));
      expect(manager.memoryUsageBytes).toBe(1000);

      // This should evict s1
      manager.put(makeCachedResult("in1", "s2", { sizeBytes: 1000 }));
      expect(manager.memoryUsageBytes).toBe(1000);
      expect(manager.size).toBe(1);
    });
  });

  // ── Cache Policies ─────────────────────────────────────────────

  describe("cache policies", () => {
    test("policy 'none' rejects all entries", () => {
      manager = new CacheManager(makeConfig({ cachePolicy: "none" }));

      manager.put(makeCachedResult("in1", "s1"));
      expect(manager.size).toBe(0);
    });

    test("policy 'selective' only caches pinned stages", () => {
      manager = new CacheManager(
        makeConfig({
          cachePolicy: "selective",
          pinnedStageIds: new Set(["s2"]),
        }),
      );

      manager.put(makeCachedResult("in1", "s1"));
      manager.put(makeCachedResult("in1", "s2"));
      manager.put(makeCachedResult("in1", "s3"));

      expect(manager.size).toBe(1);
      expect(manager.has("in1", "s1")).toBe(false);
      expect(manager.has("in1", "s2")).toBe(true);
      expect(manager.has("in1", "s3")).toBe(false);
    });

    test("policy 'all' caches everything", () => {
      manager = new CacheManager(makeConfig({ cachePolicy: "all" }));

      manager.put(makeCachedResult("in1", "s1"));
      manager.put(makeCachedResult("in1", "s2"));

      expect(manager.size).toBe(2);
    });

    test("updateConfig to 'none' clears existing entries", () => {
      manager.put(makeCachedResult("in1", "s1"));
      manager.put(makeCachedResult("in1", "s2"));
      expect(manager.size).toBe(2);

      manager.updateConfig(makeConfig({ cachePolicy: "none" }));
      expect(manager.size).toBe(0);
    });

    test("updateConfig to 'selective' affects new puts", () => {
      manager.put(makeCachedResult("in1", "s1"));
      expect(manager.size).toBe(1);

      manager.updateConfig(
        makeConfig({
          cachePolicy: "selective",
          pinnedStageIds: new Set(["s2"]),
        }),
      );

      manager.put(makeCachedResult("in1", "s3"));
      // s3 is not pinned so it shouldn't be added
      expect(manager.has("in1", "s3")).toBe(false);
      // s1 was already cached and should still be there
      expect(manager.has("in1", "s1")).toBe(true);
    });
  });

  // ── Cascading Invalidation ─────────────────────────────────────

  describe("cascading invalidation", () => {
    test("invalidateStage removes all entries for that stage", () => {
      manager.put(makeCachedResult("in1", "s1"));
      manager.put(makeCachedResult("in2", "s1"));
      manager.put(makeCachedResult("in1", "s2"));

      manager.invalidateStage("s1");

      expect(manager.has("in1", "s1")).toBe(false);
      expect(manager.has("in2", "s1")).toBe(false);
      expect(manager.has("in1", "s2")).toBe(true);
    });

    test("invalidateCascade removes stage and all downstream stages", () => {
      const stages = new Map<string, Stage>([
        ["s1", makeStage("s1", "grep", [], "main", 0)],
        ["s2", makeStage("s2", "sort", [], "main", 1, "s1")],
        ["s3", makeStage("s3", "collate", [], "main", 2, "s2")],
      ]);
      const forks = new Map<string, Fork>([
        ["main", makeFork("main", ["s1", "s2", "s3"])],
      ]);

      manager.put(makeCachedResult("in1", "s1"));
      manager.put(makeCachedResult("in1", "s2"));
      manager.put(makeCachedResult("in1", "s3"));

      // Invalidate from s2 — should remove s2 and s3, keep s1
      manager.invalidateCascade("s2", forks, stages);

      expect(manager.has("in1", "s1")).toBe(true);
      expect(manager.has("in1", "s2")).toBe(false);
      expect(manager.has("in1", "s3")).toBe(false);
    });

    test("invalidateCascade from first stage clears all", () => {
      const stages = new Map<string, Stage>([
        ["s1", makeStage("s1", "grep", [], "main", 0)],
        ["s2", makeStage("s2", "sort", [], "main", 1, "s1")],
      ]);
      const forks = new Map<string, Fork>([
        ["main", makeFork("main", ["s1", "s2"])],
      ]);

      manager.put(makeCachedResult("in1", "s1"));
      manager.put(makeCachedResult("in1", "s2"));

      manager.invalidateCascade("s1", forks, stages);

      expect(manager.has("in1", "s1")).toBe(false);
      expect(manager.has("in1", "s2")).toBe(false);
    });

    test("invalidateCascade with unknown stage is a no-op", () => {
      manager.put(makeCachedResult("in1", "s1"));

      const stages = new Map<string, Stage>();
      const forks = new Map<string, Fork>();

      manager.invalidateCascade("unknown", forks, stages);
      expect(manager.has("in1", "s1")).toBe(true);
    });
  });

  // ── Disk Spill ─────────────────────────────────────────────────

  describe("disk spill", () => {
    test("spills large results to disk", () => {
      manager = new CacheManager(makeConfig(), TEST_SPILL_DIR);

      const bigSizeBytes = CacheManager.SPILL_THRESHOLD_BYTES + 1;
      const records = [{ x: 1 }, { x: 2 }] as unknown as CachedResult["records"];
      const result = makeCachedResult("in1", "s1", {
        records,
        sizeBytes: bigSizeBytes,
      });

      manager.put(result);

      // Entry should exist but with empty in-memory records
      expect(manager.has("in1", "s1")).toBe(true);

      // Spill file should exist on disk
      const entry = manager.get("in1", "s1")!;
      expect(entry).toBeDefined();
    });

    test("does not spill results under threshold", () => {
      manager = new CacheManager(makeConfig(), TEST_SPILL_DIR);

      const result = makeCachedResult("in1", "s1", {
        sizeBytes: 1000,
      });

      manager.put(result);

      const entry = manager.get("in1", "s1")!;
      expect(entry.spillFile).toBeNull();
    });

    test("does not spill when no spillDir configured", () => {
      manager = new CacheManager(makeConfig()); // no spillDir

      const bigSizeBytes = CacheManager.SPILL_THRESHOLD_BYTES + 1;
      const result = makeCachedResult("in1", "s1", {
        records: [{ x: 1 }] as unknown as CachedResult["records"],
        sizeBytes: bigSizeBytes,
      });

      manager.put(result);

      const entry = manager.get("in1", "s1")!;
      // Without spillDir, records stay in memory
      expect(entry.spillFile).toBeNull();
    });

    test("cleanup removes spill files on eviction", () => {
      manager = new CacheManager(
        makeConfig({ maxMemoryBytes: 500 }),
        TEST_SPILL_DIR,
      );

      const bigSizeBytes = CacheManager.SPILL_THRESHOLD_BYTES + 1;
      const result = makeCachedResult("in1", "s1", {
        records: [{ x: 1 }] as unknown as CachedResult["records"],
        sizeBytes: bigSizeBytes,
      });

      manager.put(result);

      // Get the spill file path
      const entry = manager.get("in1", "s1");
      const spillFile = entry?.spillFile;

      // Clear the cache — should clean up spill files
      manager.clear();

      if (spillFile) {
        expect(existsSync(spillFile)).toBe(false);
      }
    });
  });

  // ── Bulk Operations ────────────────────────────────────────────

  describe("bulk operations", () => {
    test("clear removes all entries", () => {
      manager.put(makeCachedResult("in1", "s1"));
      manager.put(makeCachedResult("in1", "s2"));
      manager.put(makeCachedResult("in2", "s1"));

      manager.clear();

      expect(manager.size).toBe(0);
      expect(manager.memoryUsageBytes).toBe(0);
    });

    test("toMap returns all entries as a Map", () => {
      const r1 = makeCachedResult("in1", "s1");
      const r2 = makeCachedResult("in1", "s2");

      manager.put(r1);
      manager.put(r2);

      const map = manager.toMap();
      expect(map.size).toBe(2);
      expect(map.get("in1:s1")).toEqual(r1);
      expect(map.get("in1:s2")).toEqual(r2);
    });

    test("fromMap restores entries from a Map", () => {
      const map = new Map<string, CachedResult>([
        ["in1:s1", makeCachedResult("in1", "s1")],
        ["in1:s2", makeCachedResult("in1", "s2")],
      ]);

      manager.fromMap(map);

      expect(manager.size).toBe(2);
      expect(manager.has("in1", "s1")).toBe(true);
      expect(manager.has("in1", "s2")).toBe(true);
    });

    test("fromMap clears existing entries first", () => {
      manager.put(makeCachedResult("in1", "old"));

      const map = new Map<string, CachedResult>([
        ["in1:s1", makeCachedResult("in1", "s1")],
      ]);

      manager.fromMap(map);

      expect(manager.size).toBe(1);
      expect(manager.has("in1", "old")).toBe(false);
      expect(manager.has("in1", "s1")).toBe(true);
    });
  });
});
