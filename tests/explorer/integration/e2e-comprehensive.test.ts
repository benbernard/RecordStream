/**
 * Comprehensive end-to-end integration tests for the Explorer.
 *
 * Covers scenarios not fully exercised by existing tests:
 * - Large data performance (10k+ records)
 * - Cache invalidation correctness (modify stage → downstream stale)
 * - Fork operations with real execution
 * - Undo/redo state consistency across complex sequences
 * - Session save/load roundtrip with forks, inputs, and cache
 * - Multiple input sources with switching
 * - All view modes
 * - Export edge cases
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Record } from "../../../src/Record.ts";
import {
  createInitialState,
  pipelineReducer,
} from "../../../src/explorer/model/reducer.ts";
import { executeToStage } from "../../../src/explorer/executor/executor.ts";
import {
  getActivePath,
  getCursorStage,
  getCursorOutput,
  getDownstreamStages,
  isDownstreamOfError,
  getTotalCacheSize,
  getStageKind,
  getStageDelta,
} from "../../../src/explorer/model/selectors.ts";
import {
  exportAsPipeScript,
  exportAsChainCommand,
} from "../../../src/explorer/model/serialization.ts";
import { SessionManager } from "../../../src/explorer/session/session-manager.ts";
import type {
  PipelineState,
  PipelineAction,
  StageConfig,
} from "../../../src/explorer/model/types.ts";

// ── Helpers ──────────────────────────────────────────────────────────

function dispatch(state: PipelineState, action: PipelineAction): PipelineState {
  return pipelineReducer(state, action);
}

function addStage(
  state: PipelineState,
  opName: string,
  args: string[] = [],
): PipelineState {
  const config: StageConfig = { operationName: opName, args, enabled: true };
  return dispatch(state, {
    type: "ADD_STAGE",
    afterStageId: state.cursorStageId,
    config,
  });
}

function addInput(
  state: PipelineState,
  records: Record[],
  label = "test-input",
): PipelineState {
  return dispatch(state, {
    type: "ADD_INPUT",
    source: { kind: "stdin-capture", records },
    label,
  });
}

function getLastStageId(state: PipelineState): string {
  const path = getActivePath(state);
  return path[path.length - 1]!.id;
}

function getStageIds(state: PipelineState): string[] {
  return getActivePath(state).map((s) => s.id);
}

function generateRecords(count: number): Record[] {
  return Array.from({ length: count }, (_, i) =>
    new Record({
      id: i,
      name: `user-${i}`,
      score: Math.floor(Math.random() * 100),
      group: `group-${i % 10}`,
      active: i % 3 === 0,
    }),
  );
}

// ── 1. Large Data Performance ────────────────────────────────────────

describe("Large data performance", () => {
  test("10k records through grep + sort completes in < 2s", async () => {
    let state = createInitialState();
    const records = generateRecords(10_000);
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{score}} > 50"]);
    state = addStage(state, "sort", ["--key", "score=-n"]);
    const sortId = getLastStageId(state);

    const start = performance.now();
    const result = await executeToStage(state, sortId);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
    // Approximately half should pass the filter
    expect(result.recordCount).toBeGreaterThan(0);
    expect(result.recordCount).toBeLessThan(10_000);

    // Verify sort order is correct (descending by score)
    for (let i = 1; i < result.records.length; i++) {
      expect(result.records[i - 1]!.get("score")).toBeGreaterThanOrEqual(
        result.records[i]!.get("score") as number,
      );
    }
  });

  test("10k records through xform + collate completes in < 2s", async () => {
    let state = createInitialState();
    const records = Array.from({ length: 10_000 }, (_, i) =>
      new Record({
        group: `g${i % 5}`,
        value: i,
      }),
    );
    state = addInput(state, records);

    state = addStage(state, "xform", ["{{doubled}} = {{value}} * 2"]);
    state = addStage(state, "collate", ["--key", "group", "-a", "count"]);
    const collateId = getLastStageId(state);

    const start = performance.now();
    const result = await executeToStage(state, collateId);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
    expect(result.recordCount).toBe(5); // 5 groups
    // Each group should have 2000 records
    for (const rec of result.records) {
      expect(rec.get("count")).toBe(2000);
    }
  });

  test("50k records through single grep completes in < 2s", async () => {
    let state = createInitialState();
    const records = Array.from({ length: 50_000 }, (_, i) =>
      new Record({ x: i }),
    );
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} >= 25000"]);
    const grepId = getLastStageId(state);

    const start = performance.now();
    const result = await executeToStage(state, grepId);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
    expect(result.recordCount).toBe(25_000);
  });

  test("cache reuse: second execution of same stage is near-instant", async () => {
    let state = createInitialState();
    const records = generateRecords(10_000);
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{score}} > 50"]);
    state = addStage(state, "sort", ["--key", "score=-n"]);
    const sortId = getLastStageId(state);

    // First execution populates cache
    await executeToStage(state, sortId);

    // Second execution should hit cache
    const start = performance.now();
    const result = await executeToStage(state, sortId);
    const elapsed = performance.now() - start;

    // Cache hit should be very fast (< 50ms)
    expect(elapsed).toBeLessThan(50);
    expect(result.recordCount).toBeGreaterThan(0);
  });
});

// ── 2. Cache Invalidation Correctness ────────────────────────────────

describe("Cache invalidation correctness", () => {
  test("UPDATE_STAGE_ARGS invalidates the stage and all downstream", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 5 }),
      new Record({ x: 10 }),
      new Record({ x: 15 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 3"]);
    const grepId = getStageIds(state)[0]!;
    state = addStage(state, "sort", ["--key", "x=n"]);
    const sortId = getStageIds(state)[1]!;
    state = addStage(state, "grep", ["{{x}} < 20"]);
    const grep2Id = getStageIds(state)[2]!;

    // Execute full pipeline
    await executeToStage(state, grep2Id);
    expect(state.cache.has(`${state.activeInputId}:${grepId}`)).toBe(true);
    expect(state.cache.has(`${state.activeInputId}:${sortId}`)).toBe(true);
    expect(state.cache.has(`${state.activeInputId}:${grep2Id}`)).toBe(true);

    // Modify the first grep — cache for grep and all downstream should be gone
    state = dispatch(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: grepId,
      args: ["{{x}} > 10"],
    });

    expect(state.cache.has(`${state.activeInputId}:${grepId}`)).toBe(false);
    expect(state.cache.has(`${state.activeInputId}:${sortId}`)).toBe(false);
    expect(state.cache.has(`${state.activeInputId}:${grep2Id}`)).toBe(false);

    // Re-execute and verify updated results
    const result = await executeToStage(state, grep2Id);
    expect(result.recordCount).toBe(1); // only x=15 passes both greps
    expect(result.records[0]!.get("x")).toBe(15);
  });

  test("TOGGLE_STAGE invalidates downstream cache", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 1"]);
    const grepId = getStageIds(state)[0]!;
    state = addStage(state, "sort", ["--key", "x=-n"]);
    const sortId = getStageIds(state)[1]!;

    await executeToStage(state, sortId);
    expect(state.cache.has(`${state.activeInputId}:${grepId}`)).toBe(true);
    expect(state.cache.has(`${state.activeInputId}:${sortId}`)).toBe(true);

    // Disable grep
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: grepId });
    expect(state.cache.has(`${state.activeInputId}:${grepId}`)).toBe(false);
    expect(state.cache.has(`${state.activeInputId}:${sortId}`)).toBe(false);

    // Re-execute — grep disabled means sort sees all 3 records
    const result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(3);
    expect(result.records[0]!.get("x")).toBe(3);
  });

  test("modifying middle stage only invalidates that stage and downstream, not upstream", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
      new Record({ x: 4 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 1"]);
    const grepId = getStageIds(state)[0]!;
    state = addStage(state, "sort", ["--key", "x=n"]);
    const sortId = getStageIds(state)[1]!;
    state = addStage(state, "grep", ["{{x}} < 4"]);
    const grep2Id = getStageIds(state)[2]!;

    await executeToStage(state, grep2Id);

    // Cache the computedAt for the first grep
    const grepCacheBefore = state.cache.get(`${state.activeInputId}:${grepId}`)!;

    // Modify the sort (middle stage)
    state = dispatch(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: sortId,
      args: ["--key", "x=-n"],
    });

    // Upstream (first grep) should still be cached
    expect(state.cache.has(`${state.activeInputId}:${grepId}`)).toBe(true);
    const grepCacheAfter = state.cache.get(`${state.activeInputId}:${grepId}`)!;
    expect(grepCacheAfter.computedAt).toBe(grepCacheBefore.computedAt);

    // Downstream stages should be invalidated
    expect(state.cache.has(`${state.activeInputId}:${sortId}`)).toBe(false);
    expect(state.cache.has(`${state.activeInputId}:${grep2Id}`)).toBe(false);
  });

  test("executor uses cached upstream result when only downstream needs re-execution", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 0"]);
    state = addStage(state, "sort", ["--key", "x=n"]);
    const sortId = getStageIds(state)[1]!;

    // Execute full pipeline
    await executeToStage(state, sortId);

    // Invalidate only sort cache (simulate downstream-only invalidation)
    const sortCacheKey = `${state.activeInputId}:${sortId}`;
    state.cache.delete(sortCacheKey);

    // Re-execute — should start from grep cached result
    const result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(3);
    expect(result.records[0]!.get("x")).toBe(1);
  });
});

// ── 3. Fork Operations with Execution ────────────────────────────────

describe("Fork operations with execution", () => {
  test("create fork, add stages, execute independently from main", async () => {
    let state = createInitialState();
    const records = [
      new Record({ name: "Alice", score: 90 }),
      new Record({ name: "Bob", score: 60 }),
      new Record({ name: "Charlie", score: 85 }),
    ];
    state = addInput(state, records);

    // Build main pipeline: grep score > 70
    state = addStage(state, "grep", ["{{score}} > 70"]);
    const mainGrepId = getLastStageId(state);
    const mainForkId = state.activeForkId;

    // Execute main pipeline
    const mainResult = await executeToStage(state, mainGrepId);
    expect(mainResult.recordCount).toBe(2); // Alice, Charlie

    // Create a fork from the grep stage
    state = dispatch(state, {
      type: "CREATE_FORK",
      name: "experiment",
      atStageId: mainGrepId,
    });
    const expForkId = state.activeForkId;
    expect(expForkId).not.toBe(mainForkId);

    // Add different stage to the fork: sort by name
    state = addStage(state, "sort", ["--key", "name"]);
    const forkSortId = getLastStageId(state);

    // Execute fork pipeline
    const forkResult = await executeToStage(state, forkSortId);
    // Fork should see all 3 records (not filtered, since fork starts fresh)
    // Actually, fork starts with empty stageIds and its own stages
    // The fork's sort operates on the raw input
    expect(forkResult.recordCount).toBe(3);
    expect(forkResult.records[0]!.get("name")).toBe("Alice");

    // Switch back to main and verify it still has its result
    state = dispatch(state, { type: "SWITCH_FORK", forkId: mainForkId });
    const pathNames = getActivePath(state).map((s) => s.config.operationName);
    expect(pathNames).toEqual(["grep"]);
  });

  test("independent fork execution: changing fork stages doesn't affect main", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 10 }),
      new Record({ x: 20 }),
      new Record({ x: 30 }),
    ];
    state = addInput(state, records);

    // Main: grep x > 15
    state = addStage(state, "grep", ["{{x}} > 15"]);
    const mainGrepId = getLastStageId(state);
    const mainForkId = state.activeForkId;

    await executeToStage(state, mainGrepId);

    // Fork
    state = dispatch(state, {
      type: "CREATE_FORK",
      name: "fork-1",
      atStageId: mainGrepId,
    });

    // Fork: sort descending
    state = addStage(state, "sort", ["--key", "x=-n"]);
    const forkSortId = getLastStageId(state);

    const forkResult = await executeToStage(state, forkSortId);
    expect(forkResult.records[0]!.get("x")).toBe(30);

    // Switch back to main — grep cache should still be there
    state = dispatch(state, { type: "SWITCH_FORK", forkId: mainForkId });
    expect(state.cache.has(`${state.activeInputId}:${mainGrepId}`)).toBe(true);
    const mainCached = state.cache.get(`${state.activeInputId}:${mainGrepId}`)!;
    expect(mainCached.recordCount).toBe(2);
  });

  test("delete fork cleans up its stages", async () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    state = addStage(state, "grep", ["{{x}} > 0"]);
    const mainGrepId = getLastStageId(state);
    const mainForkId = state.activeForkId;

    // Create fork and add stages
    state = dispatch(state, {
      type: "CREATE_FORK",
      name: "temp-fork",
      atStageId: mainGrepId,
    });
    const forkId = state.activeForkId;
    state = addStage(state, "sort", ["--key", "x"]);
    state = addStage(state, "grep", ["true"]);

    const stagesBefore = state.stages.size;

    // Delete the fork
    state = dispatch(state, { type: "DELETE_FORK", forkId });

    // Should return to main fork
    expect(state.activeForkId).toBe(mainForkId);
    // Fork stages should be removed
    expect(state.stages.size).toBe(stagesBefore - 2);
    // Main grep should still exist
    expect(state.stages.has(mainGrepId)).toBe(true);
  });
});

// ── 4. Undo/Redo State Consistency ───────────────────────────────────

describe("Undo/redo state consistency", () => {
  test("undo after UPDATE_STAGE_ARGS restores original args and can execute", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 5 }),
      new Record({ x: 10 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 3"]);
    const grepId = getLastStageId(state);

    // Execute with original args
    let result = await executeToStage(state, grepId);
    expect(result.recordCount).toBe(2); // x=5, x=10

    // Update args
    state = dispatch(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: grepId,
      args: ["{{x}} > 8"],
    });

    // Clear cache and execute with new args
    state = { ...state, cache: new Map() };
    result = await executeToStage(state, grepId);
    expect(result.recordCount).toBe(1); // x=10

    // Undo — should restore original args
    state = dispatch(state, { type: "UNDO" });
    expect(state.stages.get(grepId)!.config.args).toEqual(["{{x}} > 3"]);

    // Clear cache and execute — should use original args
    state = { ...state, cache: new Map() };
    result = await executeToStage(state, grepId);
    expect(result.recordCount).toBe(2);
  });

  test("undo DELETE_STAGE + execute restores correct pipeline behavior", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 3 }),
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 1"]);
    state = addStage(state, "sort", ["--key", "x=n"]);
    const sortId = getLastStageId(state);

    // Execute full pipeline
    let result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(2);

    // Delete grep, leaving only sort
    const grepId = getStageIds(state)[0]!;
    state = dispatch(state, { type: "DELETE_STAGE", stageId: grepId });
    expect(getActivePath(state)).toHaveLength(1);

    // Undo the delete
    state = dispatch(state, { type: "UNDO" });
    expect(getActivePath(state)).toHaveLength(2);
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "grep",
      "sort",
    ]);

    // Clear cache and re-execute — pipeline should work as before
    state = { ...state, cache: new Map() };
    const allStageIds = getStageIds(state);
    result = await executeToStage(state, allStageIds[allStageIds.length - 1]!);
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("x")).toBe(2);
    expect(result.records[1]!.get("x")).toBe(3);
  });

  test("complex undo/redo sequence: add, modify, delete, undo x3, redo x2", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 5 }),
      new Record({ x: 10 }),
    ];
    state = addInput(state, records);

    // Step 1: Add grep (undoable)
    state = addStage(state, "grep", ["{{x}} > 0"]);
    const grepId = getLastStageId(state);
    expect(getActivePath(state)).toHaveLength(1);

    // Step 2: Update args (undoable)
    state = dispatch(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: grepId,
      args: ["{{x}} > 3"],
    });

    // Step 3: Add sort (undoable)
    state = addStage(state, "sort", ["--key", "x=n"]);
    expect(getActivePath(state)).toHaveLength(2);

    // Step 4: Delete sort (undoable)
    const sortId = getLastStageId(state);
    state = dispatch(state, { type: "DELETE_STAGE", stageId: sortId });
    expect(getActivePath(state)).toHaveLength(1);

    // Undo x3: undo delete → undo add-sort → undo update-args
    state = dispatch(state, { type: "UNDO" }); // restore sort
    expect(getActivePath(state)).toHaveLength(2);

    state = dispatch(state, { type: "UNDO" }); // undo add sort
    expect(getActivePath(state)).toHaveLength(1);

    state = dispatch(state, { type: "UNDO" }); // undo update args
    expect(state.stages.get(grepId)!.config.args).toEqual(["{{x}} > 0"]);

    // Redo x2: redo update-args → redo add-sort
    state = dispatch(state, { type: "REDO" }); // update args
    expect(state.stages.get(grepId)!.config.args).toEqual(["{{x}} > 3"]);

    state = dispatch(state, { type: "REDO" }); // add sort back
    expect(getActivePath(state)).toHaveLength(2);

    // Execute from this restored state
    state = { ...state, cache: new Map() };
    const lastId = getLastStageId(state);
    const result = await executeToStage(state, lastId);
    expect(result.recordCount).toBe(2); // x=5, x=10 (x > 3, sorted ascending)
    expect(result.records[0]!.get("x")).toBe(5);
    expect(result.records[1]!.get("x")).toBe(10);
  });

  test("undo TOGGLE_STAGE re-enables and gives correct results", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 5 }),
      new Record({ x: 10 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 3"]);
    const grepId = getLastStageId(state);
    state = addStage(state, "sort", ["--key", "x=n"]);
    const sortId = getLastStageId(state);

    // Toggle grep off
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: grepId });
    expect(state.stages.get(grepId)!.config.enabled).toBe(false);

    // Execute — all 3 records pass through
    let result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(3);

    // Undo the toggle — grep re-enabled
    state = dispatch(state, { type: "UNDO" });
    expect(state.stages.get(grepId)!.config.enabled).toBe(true);

    // Execute — only x=5, x=10 pass
    state = { ...state, cache: new Map() };
    result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(2);
  });

  test("undo REORDER_STAGE restores original order and execution", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 1"]);
    state = addStage(state, "sort", ["--key", "x=-n"]);

    const sortId = getActivePath(state)[1]!.id;

    // Reorder: move sort up (before grep)
    state = dispatch(state, {
      type: "REORDER_STAGE",
      stageId: sortId,
      direction: "up",
    });
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "sort",
      "grep",
    ]);

    // Undo reorder
    state = dispatch(state, { type: "UNDO" });
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "grep",
      "sort",
    ]);

    // Execute — grep then sort
    state = { ...state, cache: new Map() };
    const lastId = getLastStageId(state);
    const result = await executeToStage(state, lastId);
    expect(result.recordCount).toBe(2); // x > 1 → x=2,3, sorted desc
    expect(result.records[0]!.get("x")).toBe(3);
    expect(result.records[1]!.get("x")).toBe(2);
  });
});

// ── 5. Session Save/Load Roundtrip ───────────────────────────────────

describe("Session save/load comprehensive roundtrip", () => {
  let tempDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "recs-e2e-session-"));
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("complex state with forks, inputs, and pinned stages survives roundtrip", async () => {
    let state = createInitialState();

    // Add file input
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: "/tmp/access.log" },
      label: "access.log",
    });

    // Add stdin input
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [new Record({ x: 1 })] },
      label: "piped-data",
    });
    // Build pipeline
    state = addStage(state, "grep", ["{{status}} > 200"]);
    state = addStage(state, "sort", ["--key", "time=n"]);
    const sortId = getLastStageId(state);
    state = addStage(state, "collate", ["--key", "host", "-a", "count"]);

    // Pin a stage
    state = dispatch(state, { type: "PIN_STAGE", stageId: sortId });

    // Create a fork
    state = dispatch(state, {
      type: "CREATE_FORK",
      name: "alt-analysis",
      atStageId: sortId,
    });

    // Set session name
    state = dispatch(state, { type: "SET_SESSION_NAME", name: "log analysis v2" });

    // Set view mode
    state = dispatch(state, { type: "SET_VIEW_MODE", viewMode: "json" });

    // Save
    await manager.save(state);

    // Load and hydrate
    const loaded = await manager.load(state.sessionId);
    const hydrated = manager.hydrate(loaded);

    // Verify stages
    expect(hydrated.stages.size).toBe(state.stages.size);
    for (const [id, stage] of state.stages) {
      const restored = hydrated.stages.get(id);
      expect(restored).toBeDefined();
      expect(restored!.config.operationName).toBe(stage.config.operationName);
      expect(restored!.config.args).toEqual(stage.config.args);
      expect(restored!.config.enabled).toBe(stage.config.enabled);
    }

    // Verify forks
    expect(hydrated.forks.size).toBe(state.forks.size);
    const forkNames = Array.from(hydrated.forks.values()).map((f) => f.name);
    expect(forkNames).toContain("main");
    expect(forkNames).toContain("alt-analysis");

    // Verify inputs
    expect(hydrated.inputs.size).toBe(state.inputs.size);

    // Verify session name
    expect(hydrated.sessionName).toBe("log analysis v2");

    // Verify pinned stages
    expect(hydrated.cacheConfig.pinnedStageIds.has(sortId)).toBe(true);
  });

  test("saveAs creates new session with different ID", async () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);
    state = addStage(state, "grep", ["{{x}} > 0"]);
    state = dispatch(state, { type: "SET_SESSION_NAME", name: "original" });

    await manager.save(state);

    const newSessionId = await manager.saveAs(state, "copy of analysis");

    expect(newSessionId).not.toBe(state.sessionId);

    // Both sessions should be loadable
    const original = await manager.load(state.sessionId);
    const copy = await manager.load(newSessionId);

    expect(original.name).toBe("original");
    expect(copy.name).toBe("copy of analysis");
  });

  test("session list returns sessions sorted by last accessed", async () => {
    // Create 3 sessions with different times
    for (let i = 0; i < 3; i++) {
      let state = createInitialState();
      state = dispatch(state, { type: "SET_SESSION_NAME", name: `session-${i}` });
      await manager.save(state);
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
    }

    const sessions = await manager.list();
    expect(sessions).toHaveLength(3);
    // Most recent first
    expect(sessions[0]!.name).toBe("session-2");
    expect(sessions[2]!.name).toBe("session-0");
  });

  test("session delete removes session from disk", async () => {
    let state = createInitialState();
    state = dispatch(state, { type: "SET_SESSION_NAME", name: "to-delete" });
    await manager.save(state);

    let sessions = await manager.list();
    expect(sessions).toHaveLength(1);

    await manager.delete(state.sessionId);

    sessions = await manager.list();
    expect(sessions).toHaveLength(0);
  });

  test("rename updates session name on disk", async () => {
    let state = createInitialState();
    state = dispatch(state, { type: "SET_SESSION_NAME", name: "old-name" });
    await manager.save(state);

    await manager.rename(state.sessionId, "new-name");

    const loaded = await manager.load(state.sessionId);
    expect(loaded.name).toBe("new-name");
  });

  test("hydrated state with undo stack can still undo/redo correctly", async () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);
    state = addStage(state, "grep", ["{{x}} > 0"]);
    state = addStage(state, "sort", ["--key", "x"]);
    state = addStage(state, "collate", ["--key", "x", "-a", "count"]);

    // Undo once (remove collate)
    state = dispatch(state, { type: "UNDO" });
    expect(getActivePath(state)).toHaveLength(2);
    expect(state.undoStack).toHaveLength(3); // add_input, add_grep, add_sort
    expect(state.redoStack).toHaveLength(1); // add_collate

    // Save and load
    await manager.save(state);
    const loaded = await manager.load(state.sessionId);
    const hydrated = manager.hydrate(loaded);

    expect(hydrated.undoStack).toHaveLength(3);
    expect(hydrated.redoStack).toHaveLength(1);

    // Redo should restore collate
    const afterRedo = dispatch(hydrated, { type: "REDO" });
    expect(getActivePath(afterRedo)).toHaveLength(3);
    expect(getActivePath(afterRedo)[2]!.config.operationName).toBe("collate");

    // Undo should remove collate again
    const afterUndo = dispatch(afterRedo, { type: "UNDO" });
    expect(getActivePath(afterUndo)).toHaveLength(2);
  });
});

// ── 6. Multiple Input Sources ────────────────────────────────────────

describe("Multiple input sources", () => {
  test("same pipeline, different inputs produce different results", async () => {
    let state = createInitialState();

    // Input 1: scores > 50
    const input1Records = [
      new Record({ name: "Alice", score: 90 }),
      new Record({ name: "Bob", score: 30 }),
    ];
    state = addInput(state, input1Records, "high-scores");
    const input1Id = state.activeInputId;

    // Input 2: all low scores
    const input2Records = [
      new Record({ name: "Charlie", score: 20 }),
      new Record({ name: "Dave", score: 10 }),
    ];
    state = addInput(state, input2Records, "low-scores");

    // Add grep that filters score > 50
    state = addStage(state, "grep", ["{{score}} > 50"]);
    const grepId = getLastStageId(state);

    // Execute with input 2 (active — all low scores)
    let result = await executeToStage(state, grepId);
    expect(result.recordCount).toBe(0); // no scores > 50

    // Switch to input 1
    state = dispatch(state, { type: "SWITCH_INPUT", inputId: input1Id });
    expect(state.activeInputId).toBe(input1Id);

    // Execute with input 1
    result = await executeToStage(state, grepId);
    expect(result.recordCount).toBe(1); // Alice's 90
    expect(result.records[0]!.get("name")).toBe("Alice");
  });

  test("SWITCH_INPUT preserves pipeline stages", () => {
    let state = createInitialState();

    state = addInput(state, [new Record({ x: 1 })], "input-1");
    const input1Id = state.activeInputId;
    state = addInput(state, [new Record({ x: 2 })], "input-2");

    state = addStage(state, "grep", ["{{x}} > 0"]);
    state = addStage(state, "sort", ["--key", "x"]);

    expect(getActivePath(state)).toHaveLength(2);

    // Switch inputs — stages should remain
    state = dispatch(state, { type: "SWITCH_INPUT", inputId: input1Id });
    expect(getActivePath(state)).toHaveLength(2);
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "grep",
      "sort",
    ]);
  });

  test("REMOVE_INPUT switches to remaining input", () => {
    let state = createInitialState();

    state = addInput(state, [new Record({ x: 1 })], "input-1");
    const input1Id = state.activeInputId;
    state = addInput(state, [new Record({ x: 2 })], "input-2");
    const input2Id = state.activeInputId;

    expect(state.inputs.size).toBe(2);

    // Remove active input
    state = dispatch(state, { type: "REMOVE_INPUT", inputId: input2Id });
    expect(state.inputs.size).toBe(1);
    expect(state.activeInputId).toBe(input1Id);
  });

  test("cache is keyed per input — switching inputs doesn't pollute cache", async () => {
    let state = createInitialState();

    const records1 = [new Record({ x: 10 })];
    state = addInput(state, records1, "input-1");
    const input1Id = state.activeInputId;

    const records2 = [new Record({ x: 20 })];
    state = addInput(state, records2, "input-2");
    const input2Id = state.activeInputId;

    state = addStage(state, "grep", ["{{x}} > 0"]);
    const grepId = getLastStageId(state);

    // Execute with input 2
    await executeToStage(state, grepId);
    expect(state.cache.has(`${input2Id}:${grepId}`)).toBe(true);
    expect(state.cache.has(`${input1Id}:${grepId}`)).toBe(false);

    // Switch to input 1 and execute
    state = dispatch(state, { type: "SWITCH_INPUT", inputId: input1Id });
    await executeToStage(state, grepId);

    // Both should now be cached with different keys
    expect(state.cache.has(`${input1Id}:${grepId}`)).toBe(true);
    expect(state.cache.has(`${input2Id}:${grepId}`)).toBe(true);

    // Verify they have different results
    const cache1 = state.cache.get(`${input1Id}:${grepId}`)!;
    const cache2 = state.cache.get(`${input2Id}:${grepId}`)!;
    expect(cache1.records[0]!.get("x")).toBe(10);
    expect(cache2.records[0]!.get("x")).toBe(20);
  });
});

// ── 7. All View Modes ────────────────────────────────────────────────

describe("All view modes", () => {
  test("SET_VIEW_MODE cycles through all valid modes", () => {
    let state = createInitialState();
    expect(state.inspector.viewMode).toBe("table");

    state = dispatch(state, { type: "SET_VIEW_MODE", viewMode: "prettyprint" });
    expect(state.inspector.viewMode).toBe("prettyprint");

    state = dispatch(state, { type: "SET_VIEW_MODE", viewMode: "json" });
    expect(state.inspector.viewMode).toBe("json");

    state = dispatch(state, { type: "SET_VIEW_MODE", viewMode: "schema" });
    expect(state.inspector.viewMode).toBe("schema");

    state = dispatch(state, { type: "SET_VIEW_MODE", viewMode: "table" });
    expect(state.inspector.viewMode).toBe("table");
  });

  test("view mode is independent of pipeline state", async () => {
    let state = createInitialState();
    const records = [new Record({ x: 1 })];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 0"]);
    const grepId = getLastStageId(state);

    // Change view mode
    state = dispatch(state, { type: "SET_VIEW_MODE", viewMode: "json" });

    // Execute — view mode should not affect execution
    const result = await executeToStage(state, grepId);
    expect(result.recordCount).toBe(1);
    expect(state.inspector.viewMode).toBe("json");
  });

  test("TOGGLE_FOCUS switches between pipeline and inspector", () => {
    let state = createInitialState();
    expect(state.focusedPanel).toBe("pipeline");

    state = dispatch(state, { type: "TOGGLE_FOCUS" });
    expect(state.focusedPanel).toBe("inspector");

    state = dispatch(state, { type: "TOGGLE_FOCUS" });
    expect(state.focusedPanel).toBe("pipeline");
  });

  test("column highlight navigation works correctly", () => {
    let state = createInitialState();

    // No highlight initially
    expect(state.inspector.highlightedColumn).toBeNull();

    // Move right from null → first column (0)
    state = dispatch(state, {
      type: "MOVE_COLUMN_HIGHLIGHT",
      direction: "right",
      fieldCount: 5,
    });
    expect(state.inspector.highlightedColumn).toBe(0);

    // Move right
    state = dispatch(state, {
      type: "MOVE_COLUMN_HIGHLIGHT",
      direction: "right",
      fieldCount: 5,
    });
    expect(state.inspector.highlightedColumn).toBe(1);

    // Move left
    state = dispatch(state, {
      type: "MOVE_COLUMN_HIGHLIGHT",
      direction: "left",
      fieldCount: 5,
    });
    expect(state.inspector.highlightedColumn).toBe(0);

    // Move left at 0 — clamp
    state = dispatch(state, {
      type: "MOVE_COLUMN_HIGHLIGHT",
      direction: "left",
      fieldCount: 5,
    });
    expect(state.inspector.highlightedColumn).toBe(0);

    // Clear
    state = dispatch(state, { type: "CLEAR_COLUMN_HIGHLIGHT" });
    expect(state.inspector.highlightedColumn).toBeNull();
  });

  test("column highlight from null going left wraps to last column", () => {
    let state = createInitialState();

    state = dispatch(state, {
      type: "MOVE_COLUMN_HIGHLIGHT",
      direction: "left",
      fieldCount: 5,
    });
    expect(state.inspector.highlightedColumn).toBe(4); // max index
  });
});

// ── 8. Export Edge Cases ─────────────────────────────────────────────

describe("Export edge cases", () => {
  test("export with all stages disabled produces minimal output", () => {
    let state = createInitialState();
    state = addInput(state, []);

    state = addStage(state, "grep", ["{{x}} > 1"]);
    const grepId = getLastStageId(state);
    state = addStage(state, "sort", ["--key", "x"]);
    const sortId = getLastStageId(state);

    // Disable all stages
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: grepId });
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: sortId });

    const script = exportAsPipeScript(state);
    expect(script).toBe("#!/usr/bin/env bash\n");

    const chain = exportAsChainCommand(state);
    expect(chain).toBe("recs chain");
  });

  test("export preserves complex args with special characters", () => {
    let state = createInitialState();
    state = addInput(state, []);

    state = addStage(state, "xform", ["{{label}} = 'hello world'"]);
    state = addStage(state, "grep", ["{{value}} > 100 && {{active}} == true"]);

    const script = exportAsPipeScript(state);
    expect(script).toContain("recs xform");
    expect(script).toContain("recs grep");
    // The special chars should be escaped but present
    expect(script).toContain("hello world");
    expect(script).toContain("100");
  });

  test("export chain command with single stage has no pipe separator", () => {
    let state = createInitialState();
    state = addInput(state, []);

    state = addStage(state, "sort", ["--key", "x=n"]);

    const chain = exportAsChainCommand(state);
    expect(chain).toBe("recs chain sort --key x=n");
    expect(chain).not.toContain("\\|");
  });

  test("export with mixed enabled/disabled stages only includes enabled", () => {
    let state = createInitialState();
    state = addInput(state, []);

    state = addStage(state, "grep", ["{{x}} > 1"]);
    state = addStage(state, "sort", ["--key", "x"]);
    const sortId = getLastStageId(state);
    state = addStage(state, "collate", ["--key", "x", "-a", "count"]);
    state = addStage(state, "totable", []);

    // Disable sort and collate
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: sortId });
    const collateId = getActivePath(state)[2]!.id;
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: collateId });

    const chain = exportAsChainCommand(state);
    expect(chain).toContain("grep");
    expect(chain).not.toContain("sort");
    expect(chain).not.toContain("collate");
    expect(chain).toContain("totable");
  });
});

// ── 9. Selectors Comprehensive Tests ─────────────────────────────────

describe("Selectors comprehensive", () => {
  test("getDownstreamStages returns correct stages", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    state = addStage(state, "grep", ["{{x}} > 0"]);
    state = addStage(state, "sort", ["--key", "x"]);
    state = addStage(state, "collate", ["--key", "x", "-a", "count"]);
    state = addStage(state, "totable", []);

    const stageIds = getStageIds(state);
    const downstream = getDownstreamStages(state, stageIds[0]!);

    expect(downstream).toHaveLength(3);
    expect(downstream.map((s) => s.config.operationName)).toEqual([
      "sort",
      "collate",
      "totable",
    ]);
  });

  test("getStageKind classifies operations correctly", () => {
    expect(getStageKind("grep")).toBe("filter");
    expect(getStageKind("sort")).toBe("reorder");
    expect(getStageKind("collate")).toBe("aggregate");
    expect(getStageKind("substream")).toBe("aggregate");
    expect(getStageKind("xform")).toBe("transform");
    expect(getStageKind("totable")).toBe("transform");
    expect(getStageKind("fromcsv")).toBe("input");
    expect(getStageKind("fromjsonarray")).toBe("input");
  });

  test("getStageDelta computes field changes correctly", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1, y: 2 }),
      new Record({ x: 3, y: 4 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "xform", ["{{z}} = {{x}} + {{y}}"]);
    const xformId = getLastStageId(state);

    // Execute to populate cache
    await executeToStage(state, xformId);

    // Manually cache the "input stage" result to simulate parent
    // We need the parent of xform to exist in cache for delta to work
    // But xform has no parent stage — its input comes from the input source
    // So delta should have parentCount = null
    const delta = getStageDelta(state, xformId);
    expect(delta).toBeDefined();
    expect(delta!.kind).toBe("transform");
    expect(delta!.outputCount).toBe(2);
    // No parent stage, so parentCount is null
    expect(delta!.parentCount).toBeNull();
  });

  test("getCursorStage and getCursorOutput return correct values", async () => {
    let state = createInitialState();
    state = addInput(state, [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ]);

    state = addStage(state, "grep", ["{{x}} > 0"]);
    const grepId = getLastStageId(state);

    // Cursor should be on the grep
    const cursor = getCursorStage(state);
    expect(cursor).toBeDefined();
    expect(cursor!.config.operationName).toBe("grep");

    // No cached output yet
    expect(getCursorOutput(state)).toBeUndefined();

    // Execute and cache
    const result = await executeToStage(state, grepId);
    state = dispatch(state, {
      type: "CACHE_RESULT",
      inputId: state.activeInputId,
      stageId: grepId,
      result,
    });

    // Now cursor output should be available
    const cursorOutput = getCursorOutput(state);
    expect(cursorOutput).toBeDefined();
    expect(cursorOutput!.recordCount).toBe(2);
  });

  test("getTotalCacheSize sums all cache entries", async () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    state = addStage(state, "grep", ["{{x}} > 0"]);
    state = addStage(state, "sort", ["--key", "x"]);

    const stageIds = getStageIds(state);
    await executeToStage(state, stageIds[stageIds.length - 1]!);

    const totalSize = getTotalCacheSize(state);
    expect(totalSize).toBeGreaterThan(0);

    // Manually verify it matches sum
    let manualSum = 0;
    for (const entry of state.cache.values()) {
      manualSum += entry.sizeBytes;
    }
    expect(totalSize).toBe(manualSum);
  });
});

// ── 10. Cursor Movement ──────────────────────────────────────────────

describe("Cursor movement", () => {
  test("MOVE_CURSOR navigates through stages", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    state = addStage(state, "grep", ["{{x}} > 0"]);
    state = addStage(state, "sort", ["--key", "x"]);
    state = addStage(state, "totable", []);

    const stageIds = getStageIds(state);

    // Cursor should be on the last added stage
    expect(state.cursorStageId).toBe(stageIds[2]!);

    // Move up
    state = dispatch(state, { type: "MOVE_CURSOR", direction: "up" });
    expect(state.cursorStageId).toBe(stageIds[1]!);

    state = dispatch(state, { type: "MOVE_CURSOR", direction: "up" });
    expect(state.cursorStageId).toBe(stageIds[0]!);

    // Move up at top — should clamp
    state = dispatch(state, { type: "MOVE_CURSOR", direction: "up" });
    expect(state.cursorStageId).toBe(stageIds[0]!);

    // Move down
    state = dispatch(state, { type: "MOVE_CURSOR", direction: "down" });
    expect(state.cursorStageId).toBe(stageIds[1]!);

    // Move down to end
    state = dispatch(state, { type: "MOVE_CURSOR", direction: "down" });
    state = dispatch(state, { type: "MOVE_CURSOR", direction: "down" });
    expect(state.cursorStageId).toBe(stageIds[2]!);

    // Move down at bottom — should clamp
    state = dispatch(state, { type: "MOVE_CURSOR", direction: "down" });
    expect(state.cursorStageId).toBe(stageIds[2]!);
  });

  test("SET_CURSOR jumps to a specific stage", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    state = addStage(state, "grep", ["{{x}} > 0"]);
    state = addStage(state, "sort", ["--key", "x"]);
    state = addStage(state, "totable", []);

    const stageIds = getStageIds(state);

    state = dispatch(state, { type: "SET_CURSOR", stageId: stageIds[0]! });
    expect(state.cursorStageId).toBe(stageIds[0]!);
  });

  test("DELETE_STAGE moves cursor to neighbor", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    state = addStage(state, "a");
    state = addStage(state, "b");
    state = addStage(state, "c");

    const stageIds = getStageIds(state);

    // Delete middle stage (b)
    state = dispatch(state, { type: "DELETE_STAGE", stageId: stageIds[1]! });

    // Cursor should move to the stage at the same index or the last one
    expect(state.cursorStageId).not.toBeNull();
    const remainingOps = getActivePath(state).map((s) => s.config.operationName);
    expect(remainingOps).toEqual(["a", "c"]);
  });

  test("DELETE_STAGE of last stage moves cursor to previous", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    state = addStage(state, "a");
    state = addStage(state, "b");

    const stageIds = getStageIds(state);

    // Delete last stage (b)
    state = dispatch(state, { type: "DELETE_STAGE", stageId: stageIds[1]! });
    expect(state.cursorStageId).toBe(stageIds[0]!);
  });

  test("DELETE_STAGE of only stage sets cursor to null", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    state = addStage(state, "a");
    const stageIds = getStageIds(state);

    state = dispatch(state, { type: "DELETE_STAGE", stageId: stageIds[0]! });
    expect(state.cursorStageId).toBeNull();
    expect(getActivePath(state)).toHaveLength(0);
  });
});

// ── 11. Error State Management ───────────────────────────────────────

describe("Error state management", () => {
  test("SET_ERROR and CLEAR_ERROR work correctly", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);
    state = addStage(state, "grep", ["bad"]);
    const grepId = getLastStageId(state);

    expect(state.lastError).toBeNull();

    state = dispatch(state, {
      type: "SET_ERROR",
      stageId: grepId,
      message: "Parse error in expression",
    });

    expect(state.lastError).not.toBeNull();
    expect(state.lastError!.stageId).toBe(grepId);
    expect(state.lastError!.message).toBe("Parse error in expression");

    state = dispatch(state, { type: "CLEAR_ERROR" });
    expect(state.lastError).toBeNull();
  });

  test("deleting the error stage clears the error", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);
    state = addStage(state, "grep", ["bad"]);
    const grepId = getLastStageId(state);

    state = dispatch(state, {
      type: "SET_ERROR",
      stageId: grepId,
      message: "Error",
    });
    expect(state.lastError).not.toBeNull();

    state = dispatch(state, { type: "DELETE_STAGE", stageId: grepId });
    expect(state.lastError).toBeNull();
  });

  test("isDownstreamOfError correctly identifies downstream stages", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    state = addStage(state, "a");
    state = addStage(state, "b");
    state = addStage(state, "c");

    const stageIds = getStageIds(state);

    // Set error on stage b
    state = dispatch(state, {
      type: "SET_ERROR",
      stageId: stageIds[1]!,
      message: "Error",
    });

    expect(isDownstreamOfError(state, stageIds[0]!)).toBe(false); // upstream
    expect(isDownstreamOfError(state, stageIds[1]!)).toBe(false); // error stage itself
    expect(isDownstreamOfError(state, stageIds[2]!)).toBe(true);  // downstream
  });
});

// ── 12. Execution State ──────────────────────────────────────────────

describe("Execution state", () => {
  test("SET_EXECUTING toggles executing flag", () => {
    let state = createInitialState();

    expect(state.executing).toBe(false);

    state = dispatch(state, { type: "SET_EXECUTING", executing: true });
    expect(state.executing).toBe(true);

    state = dispatch(state, { type: "SET_EXECUTING", executing: false });
    expect(state.executing).toBe(false);
  });
});

// ── 13. Cache Policy Integration ─────────────────────────────────────

describe("Cache policy integration", () => {
  test("PIN_STAGE toggles pin status", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);
    state = addStage(state, "grep", ["{{x}} > 0"]);
    const grepId = getLastStageId(state);

    expect(state.cacheConfig.pinnedStageIds.has(grepId)).toBe(false);

    // Pin
    state = dispatch(state, { type: "PIN_STAGE", stageId: grepId });
    expect(state.cacheConfig.pinnedStageIds.has(grepId)).toBe(true);

    // Unpin
    state = dispatch(state, { type: "PIN_STAGE", stageId: grepId });
    expect(state.cacheConfig.pinnedStageIds.has(grepId)).toBe(false);
  });

  test("SET_CACHE_POLICY changes policy", () => {
    let state = createInitialState();

    expect(state.cacheConfig.cachePolicy).toBe("all");

    state = dispatch(state, { type: "SET_CACHE_POLICY", policy: "selective" });
    expect(state.cacheConfig.cachePolicy).toBe("selective");

    state = dispatch(state, { type: "SET_CACHE_POLICY", policy: "none" });
    expect(state.cacheConfig.cachePolicy).toBe("none");

    state = dispatch(state, { type: "SET_CACHE_POLICY", policy: "all" });
    expect(state.cacheConfig.cachePolicy).toBe("all");
  });
});

// ── 14. Noop Guards ──────────────────────────────────────────────────

describe("Noop guards", () => {
  test("DELETE_STAGE on nonexistent stage is noop (no undo entry)", () => {
    let state = createInitialState();
    const undoCountBefore = state.undoStack.length;

    state = dispatch(state, { type: "DELETE_STAGE", stageId: "nonexistent" });
    expect(state.undoStack.length).toBe(undoCountBefore);
  });

  test("UPDATE_STAGE_ARGS on nonexistent stage is noop", () => {
    let state = createInitialState();
    const undoCountBefore = state.undoStack.length;

    state = dispatch(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: "nonexistent",
      args: ["new-args"],
    });
    expect(state.undoStack.length).toBe(undoCountBefore);
  });

  test("TOGGLE_STAGE on nonexistent stage is noop", () => {
    let state = createInitialState();
    const before = state;

    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: "nonexistent" });
    expect(state).toBe(before);
  });

  test("REORDER_STAGE at boundary is noop", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);
    state = addStage(state, "a");

    const stageId = getLastStageId(state);
    const undoCountBefore = state.undoStack.length;

    // Try to move up when already at top
    state = dispatch(state, {
      type: "REORDER_STAGE",
      stageId,
      direction: "up",
    });
    expect(state.undoStack.length).toBe(undoCountBefore);
  });

  test("REMOVE_INPUT when only one input is noop", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })], "only-input");
    const inputId = state.activeInputId;
    const undoCountBefore = state.undoStack.length;

    state = dispatch(state, { type: "REMOVE_INPUT", inputId });
    expect(state.undoStack.length).toBe(undoCountBefore);
    expect(state.inputs.size).toBe(1);
  });
});
