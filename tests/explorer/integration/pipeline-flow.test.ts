/**
 * Integration tests for the Explorer pipeline flow.
 *
 * These tests exercise the real reducer, real executor, and real operations
 * together to verify the full lifecycle works correctly.
 */

import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import {
  createInitialState,
  pipelineReducer,
} from "../../../src/explorer/model/reducer.ts";
import { executeToStage } from "../../../src/explorer/executor/executor.ts";
import {
  getActivePath,
  getEnabledStages,
  isDownstreamOfError,
} from "../../../src/explorer/model/selectors.ts";
import {
  exportAsPipeScript,
  exportAsChainCommand,
} from "../../../src/explorer/model/serialization.ts";
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
  args: string[],
): PipelineState {
  const config: StageConfig = {
    operationName: opName,
    args,
    enabled: true,
  };
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

// ── 1. Full pipeline lifecycle ───────────────────────────────────────

describe("Full pipeline lifecycle", () => {
  test("create state → add stages → execute → verify records at each stage", async () => {
    let state = createInitialState();

    // Add input records
    const records = [
      new Record({ name: "Alice", age: 30 }),
      new Record({ name: "Bob", age: 20 }),
      new Record({ name: "Charlie", age: 35 }),
      new Record({ name: "Dave", age: 25 }),
    ];
    state = addInput(state, records);

    // Add stages: grep (age > 25) → sort (age ascending)
    state = addStage(state, "grep", ["{{age}} > 25"]);
    const grepId = getLastStageId(state);

    state = addStage(state, "sort", ["--key", "age=n"]);
    const sortId = getLastStageId(state);

    // Execute to grep stage
    const grepResult = await executeToStage(state, grepId);
    expect(grepResult.recordCount).toBe(2);
    expect(grepResult.records.map((r) => r.get("name")).sort()).toEqual([
      "Alice",
      "Charlie",
    ]);

    // Execute to sort stage
    const sortResult = await executeToStage(state, sortId);
    expect(sortResult.recordCount).toBe(2);
    expect(sortResult.records[0]!.get("name")).toBe("Alice");
    expect(sortResult.records[0]!.get("age")).toBe(30);
    expect(sortResult.records[1]!.get("name")).toBe("Charlie");
    expect(sortResult.records[1]!.get("age")).toBe(35);
  });

  test("3-stage pipeline: grep → sort → collate", async () => {
    let state = createInitialState();
    const records = [
      new Record({ group: "a", val: 10 }),
      new Record({ group: "b", val: 20 }),
      new Record({ group: "a", val: 30 }),
      new Record({ group: "b", val: 5 }),
      new Record({ group: "a", val: 15 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{val}} > 10"]);
    state = addStage(state, "sort", ["--key", "group"]);
    state = addStage(state, "collate", ["--key", "group", "-a", "count"]);
    const collateId = getLastStageId(state);

    const result = await executeToStage(state, collateId);
    expect(result.recordCount).toBe(2);

    const groups = result.records.map((r) => ({
      group: r.get("group"),
      count: r.get("count"),
    }));
    const sortedGroups = groups.sort((a, b) =>
      String(a.group).localeCompare(String(b.group)),
    );
    expect(sortedGroups[0]).toEqual({ group: "a", count: 2 });
    expect(sortedGroups[1]).toEqual({ group: "b", count: 1 });
  });
});

// ── 2. Undo/redo + execution ─────────────────────────────────────────

describe("Undo/redo + execution", () => {
  test("undo removes stage, execution uses updated path", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 3 }),
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ];
    state = addInput(state, records);

    // Add grep → sort
    state = addStage(state, "grep", ["{{x}} > 1"]);
    state = addStage(state, "sort", ["--key", "x=n"]);

    // Verify 2-stage pipeline works
    const stageIds = getStageIds(state);
    expect(stageIds.length).toBe(2);

    // Undo the sort addition
    state = dispatch(state, { type: "UNDO" });
    const afterUndo = getStageIds(state);
    expect(afterUndo.length).toBe(1);

    // Execute — should only run grep
    const result = await executeToStage(state, afterUndo[0]!);
    expect(result.recordCount).toBe(2);

    // Redo the sort
    state = dispatch(state, { type: "REDO" });
    const afterRedo = getStageIds(state);
    expect(afterRedo.length).toBe(2);

    // Execute the full pipeline again
    // Clear cache to force re-execution
    state = { ...state, cache: new Map() };
    const finalResult = await executeToStage(state, afterRedo[1]!);
    expect(finalResult.recordCount).toBe(2);
    expect(finalResult.records[0]!.get("x")).toBe(2);
    expect(finalResult.records[1]!.get("x")).toBe(3);
  });
});

// ── 3. Cache invalidation ────────────────────────────────────────────

describe("Cache invalidation", () => {
  test("modify middle stage args → downstream caches invalidated → re-execute", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 5 }),
      new Record({ x: 1 }),
      new Record({ x: 3 }),
      new Record({ x: 2 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 1"]);
    const grepId = getStageIds(state)[0]!;
    state = addStage(state, "sort", ["--key", "x=n"]);
    const sortId = getStageIds(state)[1]!;

    // Execute full pipeline
    await executeToStage(state, sortId);
    expect(state.cache.has(`${state.activeInputId}:${grepId}`)).toBe(true);
    expect(state.cache.has(`${state.activeInputId}:${sortId}`)).toBe(true);

    // Update grep args to be more restrictive
    state = dispatch(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: grepId,
      args: ["{{x}} > 3"],
    });

    // Invalidate downstream caches
    state = dispatch(state, { type: "INVALIDATE_STAGE", stageId: grepId });
    state = dispatch(state, { type: "INVALIDATE_STAGE", stageId: sortId });

    // Re-execute
    const result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(1);
    expect(result.records[0]!.get("x")).toBe(5);
  });
});

// ── 4. Error propagation ─────────────────────────────────────────────

describe("Error propagation", () => {
  test("bad expression in stage 2 → error captured → downstream marked", async () => {
    let state = createInitialState();
    const records = [new Record({ x: 1 })];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 0"]);
    const grepId = getStageIds(state)[0]!;
    state = addStage(state, "grep", ["this is not valid {{{{"]); // bad expression
    const badId = getStageIds(state)[1]!;
    state = addStage(state, "sort", ["--key", "x=n"]);
    const sortId = getStageIds(state)[2]!;

    // Execute should throw on the bad stage
    let caughtError = false;
    try {
      await executeToStage(state, sortId);
    } catch (e) {
      caughtError = true;
      // Set error in state
      state = dispatch(state, {
        type: "SET_ERROR",
        stageId: badId,
        message: String(e),
      });
    }

    expect(caughtError).toBe(true);
    expect(state.lastError).not.toBeNull();
    expect(state.lastError!.stageId).toBe(badId);

    // Stage 1 (grep) is not downstream of error
    expect(isDownstreamOfError(state, grepId)).toBe(false);
    // Bad stage itself is not "downstream" (it IS the error)
    expect(isDownstreamOfError(state, badId)).toBe(false);
    // Stage 3 (sort) IS downstream of error
    expect(isDownstreamOfError(state, sortId)).toBe(true);
  });
});

// ── 5. Export round-trip ─────────────────────────────────────────────

describe("Export round-trip", () => {
  test("build pipeline → export as pipe script → verify valid shell", () => {
    let state = createInitialState();
    const records = [new Record({ x: 1 })];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 2"]);
    state = addStage(state, "sort", ["--key", "x=n"]);
    state = addStage(state, "totable", []);

    const pipeScript = exportAsPipeScript(state);
    expect(pipeScript).toContain("#!/usr/bin/env bash");
    expect(pipeScript).toContain("recs grep");
    expect(pipeScript).toContain("| recs sort --key x=n");
    expect(pipeScript).toContain("| recs totable");
    // Should have line continuations
    expect(pipeScript).toContain("\\\n");

    const chainCmd = exportAsChainCommand(state);
    expect(chainCmd).toContain("recs chain");
    expect(chainCmd).toContain("grep");
    expect(chainCmd).toContain("\\| sort --key x=n");
    expect(chainCmd).toContain("\\| totable");
  });

  test("export preserves stage order from reducer", () => {
    let state = createInitialState();
    state = addInput(state, []);

    state = addStage(state, "grep", ["{{x}} > 1"]);
    state = addStage(state, "sort", ["--key", "x=n"]);
    state = addStage(state, "xform", ["{{y}} = {{x}} * 2"]);

    const chain = exportAsChainCommand(state);
    const parts = chain.replace("recs chain ", "").split(" \\| ");
    expect(parts[0]).toContain("grep");
    expect(parts[1]).toContain("sort");
    expect(parts[2]).toContain("xform");
  });
});

// ── 6. Toggle stage ──────────────────────────────────────────────────

describe("Toggle stage", () => {
  test("disable a stage → execute → disabled stage is skipped", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 3 }),
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 1"]);
    const grepId = getStageIds(state)[0]!;
    state = addStage(state, "sort", ["--key", "x=n"]);
    const sortId = getStageIds(state)[1]!;

    // Disable grep
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: grepId });

    const stage = state.stages.get(grepId)!;
    expect(stage.config.enabled).toBe(false);

    // Execute — grep is skipped, sort gets all 3 records
    const result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(3);
    expect(result.records[0]!.get("x")).toBe(1);
    expect(result.records[1]!.get("x")).toBe(2);
    expect(result.records[2]!.get("x")).toBe(3);

    // Verify disabled stage is excluded from export
    const enabledStages = getEnabledStages(state);
    expect(enabledStages.length).toBe(1);
    expect(enabledStages[0]!.config.operationName).toBe("sort");
  });

  test("re-enable a stage → execute → stage processes again", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 3 }),
      new Record({ x: 1 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ["{{x}} > 2"]);
    const grepId = getStageIds(state)[0]!;
    state = addStage(state, "sort", ["--key", "x=n"]);
    const sortId = getStageIds(state)[1]!;

    // Disable then re-enable grep
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: grepId });
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: grepId });

    expect(state.stages.get(grepId)!.config.enabled).toBe(true);

    // Clear cache and re-execute
    state = { ...state, cache: new Map() };
    const result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(1);
    expect(result.records[0]!.get("x")).toBe(3);
  });
});

// ── 7. Large pipeline ────────────────────────────────────────────────

describe("Large pipeline", () => {
  test("10+ stages execute correctly through full path", async () => {
    let state = createInitialState();

    // Create 20 records with x: 1..20
    const records = Array.from({ length: 20 }, (_, i) =>
      new Record({ x: i + 1, group: i % 3 === 0 ? "a" : "b" }),
    );
    state = addInput(state, records);

    // Build a 10-stage pipeline:
    // 1. grep x > 5
    // 2. sort by x ascending
    // 3. xform: add doubled field
    // 4. grep doubled > 20
    // 5. sort by doubled descending
    // 6-10: five more grep stages that each pass everything through
    state = addStage(state, "grep", ["{{x}} > 5"]);
    state = addStage(state, "sort", ["--key", "x=n"]);
    state = addStage(state, "xform", ["{{doubled}} = {{x}} * 2"]);
    state = addStage(state, "grep", ["{{doubled}} > 20"]);
    state = addStage(state, "sort", ["--key", "doubled=-n"]);

    // Add 5 pass-through grep stages (always true)
    for (let i = 0; i < 5; i++) {
      state = addStage(state, "grep", ["true"]);
    }

    const stageIds = getStageIds(state);
    expect(stageIds.length).toBe(10);

    // Execute to final stage
    const lastId = stageIds[stageIds.length - 1]!;
    const result = await executeToStage(state, lastId);

    // x > 5 gives 15 records (6..20)
    // doubled > 20 means x > 10, so records with x: 11..20 (10 records)
    // sorted by doubled descending → x: 20, 19, 18, ..., 11
    expect(result.recordCount).toBe(10);
    expect(result.records[0]!.get("x")).toBe(20);
    expect(result.records[0]!.get("doubled")).toBe(40);
    expect(result.records[9]!.get("x")).toBe(11);
    expect(result.records[9]!.get("doubled")).toBe(22);

    // All intermediate stages should be cached
    for (const id of stageIds) {
      expect(state.cache.has(`${state.activeInputId}:${id}`)).toBe(true);
    }
  });
});

// ── 8. Input op integration (fromcsv) ────────────────────────────────

describe("Input op integration", () => {
  test("fromcsv as first stage with file input", async () => {
    const csvContent = "name,score\nAlice,90\nBob,85\nCharlie,95\n";
    const tmpFile = `/tmp/recs-explorer-integration-${Date.now()}.csv`;
    await Bun.write(tmpFile, csvContent);

    let state = createInitialState();
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: tmpFile },
      label: "test.csv",
    });

    state = addStage(state, "fromcsv", ["--header"]);
    state = addStage(state, "sort", ["--key", "score=-n"]);
    const sortId = getLastStageId(state);

    const result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(3);
    expect(result.records[0]!.get("name")).toBe("Charlie");
    expect(result.records[1]!.get("name")).toBe("Alice");
    expect(result.records[2]!.get("name")).toBe("Bob");

    // Clean up
    const fs = await import("node:fs");
    fs.unlinkSync(tmpFile);
  });
});
