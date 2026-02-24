import { describe, test, expect, beforeEach } from "bun:test";
import {
  pipelineReducer,
  createInitialState,
} from "../../../src/explorer/model/reducer.ts";
import {
  getActivePath,
  isDownstreamOfError,
  getStageOutput,
  getDownstreamStages,
  getEnabledStages,
  getCursorStage,
  getCursorOutput,
  getTotalCacheSize,
} from "../../../src/explorer/model/selectors.ts";
import type {
  PipelineState,
  StageConfig,
  CachedResult,
} from "../../../src/explorer/model/types.ts";

function makeConfig(name: string, args: string[] = []): StageConfig {
  return { operationName: name, args, enabled: true };
}

function addStage(
  state: PipelineState,
  name: string,
  args: string[] = [],
): PipelineState {
  return pipelineReducer(state, {
    type: "ADD_STAGE",
    afterStageId: state.cursorStageId,
    config: makeConfig(name, args),
  });
}

function makeCacheResult(
  state: PipelineState,
  stageId: string,
  overrides?: Partial<CachedResult>,
): CachedResult {
  return {
    key: `${state.activeInputId}:${stageId}`,
    stageId,
    inputId: state.activeInputId,
    records: [],
    lines: [],
    spillFile: null,
    recordCount: 10,
    fieldNames: ["a"],
    computedAt: Date.now(),
    sizeBytes: 100,
    computeTimeMs: 5,
    ...overrides,
  };
}

// ── Empty pipeline operations ────────────────────────────────────

describe("Empty pipeline operations", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("getActivePath returns empty for fresh state", () => {
    expect(getActivePath(state)).toHaveLength(0);
  });

  test("cursorStageId is null in fresh state", () => {
    expect(state.cursorStageId).toBeNull();
  });

  test("MOVE_CURSOR is no-op on empty pipeline", () => {
    const before = state;
    state = pipelineReducer(state, {
      type: "MOVE_CURSOR",
      direction: "down",
    });
    expect(state).toBe(before);

    state = pipelineReducer(state, {
      type: "MOVE_CURSOR",
      direction: "up",
    });
    expect(state).toBe(before);
  });

  test("TOGGLE_FOCUS works on empty pipeline", () => {
    expect(state.focusedPanel).toBe("pipeline");
    state = pipelineReducer(state, { type: "TOGGLE_FOCUS" });
    expect(state.focusedPanel).toBe("inspector");
  });

  test("getEnabledStages returns empty for fresh state", () => {
    expect(getEnabledStages(state)).toHaveLength(0);
  });

  test("getCursorStage returns undefined for fresh state", () => {
    expect(getCursorStage(state)).toBeUndefined();
  });

  test("getCursorOutput returns undefined for fresh state", () => {
    expect(getCursorOutput(state)).toBeUndefined();
  });

  test("getTotalCacheSize returns 0 for fresh state", () => {
    expect(getTotalCacheSize(state)).toBe(0);
  });
});

// ── Delete last stage ────────────────────────────────────────────

describe("Delete last stage", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("deleting the only stage leaves pipeline empty", () => {
    state = addStage(state, "grep");
    const id = state.cursorStageId!;

    state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: id });

    expect(getActivePath(state)).toHaveLength(0);
    expect(state.cursorStageId).toBeNull();
    expect(state.stages.size).toBe(0);
  });

  test("deleting the last of multiple stages moves cursor to previous", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    state = addStage(state, "c");
    const cId = state.cursorStageId!;

    state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: cId });

    expect(getActivePath(state)).toHaveLength(2);
    // Cursor should point to the new last stage
    const lastStage = getActivePath(state).at(-1)!;
    expect(state.cursorStageId).toBe(lastStage.id);
  });

  test("deleting the first of multiple stages moves cursor to new first", () => {
    state = addStage(state, "a");
    const aId = getActivePath(state)[0]!.id;
    state = addStage(state, "b");
    state = addStage(state, "c");

    state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: aId });

    expect(getActivePath(state)).toHaveLength(2);
    const firstStage = getActivePath(state)[0]!;
    expect(state.cursorStageId).toBe(firstStage.id);
    expect(firstStage.parentId).toBeNull();
  });

  test("delete all stages one by one", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    state = addStage(state, "c");

    // Delete c
    const cId = getActivePath(state)[2]!.id;
    state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: cId });
    expect(getActivePath(state)).toHaveLength(2);

    // Delete b
    const bId = getActivePath(state)[1]!.id;
    state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: bId });
    expect(getActivePath(state)).toHaveLength(1);

    // Delete a
    const aId = getActivePath(state)[0]!.id;
    state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: aId });
    expect(getActivePath(state)).toHaveLength(0);
    expect(state.cursorStageId).toBeNull();
  });
});

// ── Error propagation edge cases ─────────────────────────────────

describe("Error propagation edge cases", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("error on first stage marks all others as downstream", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    const bId = state.cursorStageId!;
    state = addStage(state, "c");
    const cId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "SET_ERROR",
      stageId: aId,
      message: "bad expression",
    });

    expect(isDownstreamOfError(state, aId)).toBe(false);
    expect(isDownstreamOfError(state, bId)).toBe(true);
    expect(isDownstreamOfError(state, cId)).toBe(true);
  });

  test("error on last stage marks nothing as downstream", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    const bId = state.cursorStageId!;
    state = addStage(state, "c");
    const cId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "SET_ERROR",
      stageId: cId,
      message: "bad expression",
    });

    expect(isDownstreamOfError(state, aId)).toBe(false);
    expect(isDownstreamOfError(state, bId)).toBe(false);
    expect(isDownstreamOfError(state, cId)).toBe(false);
  });

  test("clearing error resets all downstream flags", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    const bId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "SET_ERROR",
      stageId: aId,
      message: "bad",
    });
    expect(isDownstreamOfError(state, bId)).toBe(true);

    state = pipelineReducer(state, { type: "CLEAR_ERROR" });
    expect(isDownstreamOfError(state, bId)).toBe(false);
  });

  test("deleting the error stage clears the error", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    const bId = state.cursorStageId!;
    state = addStage(state, "c");

    state = pipelineReducer(state, {
      type: "SET_ERROR",
      stageId: bId,
      message: "bad",
    });
    expect(state.lastError).not.toBeNull();

    state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: bId });
    expect(state.lastError).toBeNull();
  });

  test("deleting a non-error stage does not clear the error", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    state = addStage(state, "c");
    const cId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "SET_ERROR",
      stageId: aId,
      message: "bad",
    });

    state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: cId });
    expect(state.lastError).not.toBeNull();
    expect(state.lastError!.stageId).toBe(aId);
  });

  test("isDownstreamOfError with no error returns false for all", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    const bId = state.cursorStageId!;

    expect(isDownstreamOfError(state, aId)).toBe(false);
    expect(isDownstreamOfError(state, bId)).toBe(false);
  });
});

// ── PIN_STAGE ───────────────────────────────────────────────────

describe("PIN_STAGE", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("pinning a stage adds it to pinnedStageIds", () => {
    state = addStage(state, "grep");
    const id = state.cursorStageId!;

    state = pipelineReducer(state, { type: "PIN_STAGE", stageId: id });
    expect(state.cacheConfig.pinnedStageIds.has(id)).toBe(true);
  });

  test("pinning an already-pinned stage unpins it", () => {
    state = addStage(state, "grep");
    const id = state.cursorStageId!;

    state = pipelineReducer(state, { type: "PIN_STAGE", stageId: id });
    expect(state.cacheConfig.pinnedStageIds.has(id)).toBe(true);

    state = pipelineReducer(state, { type: "PIN_STAGE", stageId: id });
    expect(state.cacheConfig.pinnedStageIds.has(id)).toBe(false);
  });

  test("multiple stages can be pinned", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    const bId = state.cursorStageId!;

    state = pipelineReducer(state, { type: "PIN_STAGE", stageId: aId });
    state = pipelineReducer(state, { type: "PIN_STAGE", stageId: bId });

    expect(state.cacheConfig.pinnedStageIds.size).toBe(2);
  });
});

// ── SET_CACHE_POLICY ─────────────────────────────────────────────

describe("SET_CACHE_POLICY", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("changes cache policy to selective", () => {
    state = pipelineReducer(state, {
      type: "SET_CACHE_POLICY",
      policy: "selective",
    });
    expect(state.cacheConfig.cachePolicy).toBe("selective");
  });

  test("changes cache policy to none", () => {
    state = pipelineReducer(state, {
      type: "SET_CACHE_POLICY",
      policy: "none",
    });
    expect(state.cacheConfig.cachePolicy).toBe("none");
  });

  test("changes cache policy back to all", () => {
    state = pipelineReducer(state, {
      type: "SET_CACHE_POLICY",
      policy: "none",
    });
    state = pipelineReducer(state, {
      type: "SET_CACHE_POLICY",
      policy: "all",
    });
    expect(state.cacheConfig.cachePolicy).toBe("all");
  });
});

// ── SET_VIEW_MODE ───────────────────────────────────────────────

describe("SET_VIEW_MODE", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("defaults to table", () => {
    expect(state.inspector.viewMode).toBe("table");
  });

  test("cycles through view modes", () => {
    const modes = ["prettyprint", "json", "schema", "table"] as const;
    for (const mode of modes) {
      state = pipelineReducer(state, { type: "SET_VIEW_MODE", viewMode: mode });
      expect(state.inspector.viewMode).toBe(mode);
    }
  });
});

// ── SET_SESSION_NAME ─────────────────────────────────────────────

describe("SET_SESSION_NAME", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("sets session name", () => {
    state = pipelineReducer(state, {
      type: "SET_SESSION_NAME",
      name: "my experiment",
    });
    expect(state.sessionName).toBe("my experiment");
  });

  test("overwrites existing name", () => {
    state = pipelineReducer(state, {
      type: "SET_SESSION_NAME",
      name: "first",
    });
    state = pipelineReducer(state, {
      type: "SET_SESSION_NAME",
      name: "second",
    });
    expect(state.sessionName).toBe("second");
  });
});

// ── getDownstreamStages edge cases ───────────────────────────────

describe("getDownstreamStages edge cases", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("returns empty for last stage", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    const bId = state.cursorStageId!;

    expect(getDownstreamStages(state, bId)).toHaveLength(0);
  });

  test("returns empty for unknown stageId", () => {
    state = addStage(state, "a");
    expect(getDownstreamStages(state, "nonexistent")).toHaveLength(0);
  });

  test("returns all subsequent stages", () => {
    state = addStage(state, "a");
    const aId = getActivePath(state)[0]!.id;
    state = addStage(state, "b");
    state = addStage(state, "c");
    state = addStage(state, "d");

    const downstream = getDownstreamStages(state, aId);
    expect(downstream.map((s) => s.config.operationName)).toEqual([
      "b",
      "c",
      "d",
    ]);
  });
});

// ── Cache invalidation on stage operations ───────────────────────

describe("Cache invalidation on stage operations", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "test",
    });
  });

  test("UPDATE_STAGE_ARGS invalidates modified stage and downstream", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    const bId = state.cursorStageId!;
    state = addStage(state, "c");
    const cId = state.cursorStageId!;

    // Populate cache for all stages
    for (const id of [aId, bId, cId]) {
      state = pipelineReducer(state, {
        type: "CACHE_RESULT",
        inputId: state.activeInputId,
        stageId: id,
        result: makeCacheResult(state, id),
      });
    }
    expect(state.cache.size).toBe(3);

    // Update b's args — should invalidate b and c, keep a
    state = pipelineReducer(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: bId,
      args: ["new-arg"],
    });

    expect(getStageOutput(state, aId)).toBeDefined();
    expect(getStageOutput(state, bId)).toBeUndefined();
    expect(getStageOutput(state, cId)).toBeUndefined();
  });

  test("TOGGLE_STAGE invalidates toggled stage and downstream", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    const bId = state.cursorStageId!;

    // Populate cache
    for (const id of [aId, bId]) {
      state = pipelineReducer(state, {
        type: "CACHE_RESULT",
        inputId: state.activeInputId,
        stageId: id,
        result: makeCacheResult(state, id),
      });
    }

    // Toggle a — should invalidate both
    state = pipelineReducer(state, { type: "TOGGLE_STAGE", stageId: aId });

    expect(getStageOutput(state, aId)).toBeUndefined();
    expect(getStageOutput(state, bId)).toBeUndefined();
  });

  test("INVALIDATE_STAGE removes all cache entries for that stage", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "CACHE_RESULT",
      inputId: state.activeInputId,
      stageId: aId,
      result: makeCacheResult(state, aId),
    });
    expect(getStageOutput(state, aId)).toBeDefined();

    state = pipelineReducer(state, {
      type: "INVALIDATE_STAGE",
      stageId: aId,
    });
    expect(getStageOutput(state, aId)).toBeUndefined();
  });

  test("getTotalCacheSize tracks cumulative size", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    const bId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "CACHE_RESULT",
      inputId: state.activeInputId,
      stageId: aId,
      result: makeCacheResult(state, aId, { sizeBytes: 500 }),
    });
    state = pipelineReducer(state, {
      type: "CACHE_RESULT",
      inputId: state.activeInputId,
      stageId: bId,
      result: makeCacheResult(state, bId, { sizeBytes: 300 }),
    });

    expect(getTotalCacheSize(state)).toBe(800);
  });
});

// ── wouldBeNoop guard ────────────────────────────────────────────

describe("wouldBeNoop guard (no-op actions skip undo checkpoint)", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("DELETE_STAGE on nonexistent id is no-op and does not push undo", () => {
    state = addStage(state, "a");
    const undoLen = state.undoStack.length;

    state = pipelineReducer(state, {
      type: "DELETE_STAGE",
      stageId: "nonexistent",
    });
    expect(state.undoStack.length).toBe(undoLen);
  });

  test("UPDATE_STAGE_ARGS on nonexistent id is no-op", () => {
    state = addStage(state, "a");
    const undoLen = state.undoStack.length;

    state = pipelineReducer(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: "nonexistent",
      args: ["x"],
    });
    expect(state.undoStack.length).toBe(undoLen);
  });

  test("TOGGLE_STAGE on nonexistent id is no-op", () => {
    const before = state;
    state = pipelineReducer(state, {
      type: "TOGGLE_STAGE",
      stageId: "nonexistent",
    });
    expect(state).toBe(before);
  });

  test("REORDER_STAGE at boundary is no-op and does not push undo", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    const aId = getActivePath(state)[0]!.id;
    const undoLen = state.undoStack.length;

    // Moving first stage up is a no-op
    state = pipelineReducer(state, {
      type: "REORDER_STAGE",
      stageId: aId,
      direction: "up",
    });
    expect(state.undoStack.length).toBe(undoLen);
  });

  test("DELETE_FORK on main fork is no-op", () => {
    const before = state;
    state = pipelineReducer(state, {
      type: "DELETE_FORK",
      forkId: state.activeForkId,
    });
    expect(state).toBe(before);
  });

  test("REMOVE_INPUT with single input is no-op", () => {
    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "only",
    });
    const before = state;

    state = pipelineReducer(state, {
      type: "REMOVE_INPUT",
      inputId: state.activeInputId,
    });
    expect(state).toBe(before);
  });
});
