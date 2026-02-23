import { describe, test, expect, beforeEach } from "bun:test";
import {
  pipelineReducer,
  createInitialState,
} from "../../../src/explorer/model/reducer.ts";
import {
  getActivePath,
  getStageOutput,
} from "../../../src/explorer/model/selectors.ts";
import type {
  PipelineState,
  StageConfig,
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

// ── CREATE_FORK ──────────────────────────────────────────────────

describe("CREATE_FORK", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("creates a new fork and switches to it", () => {
    state = addStage(state, "grep");
    const stageId = state.cursorStageId!;
    const originalForkId = state.activeForkId;

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "experiment-1",
      atStageId: stageId,
    });

    expect(state.activeForkId).not.toBe(originalForkId);
    expect(state.forks.size).toBe(2);

    const newFork = state.forks.get(state.activeForkId)!;
    expect(newFork.name).toBe("experiment-1");
    expect(newFork.forkPointStageId).toBe(stageId);
    expect(newFork.parentForkId).toBe(originalForkId);
    expect(newFork.stageIds).toEqual([]);
  });

  test("new fork starts with empty stage list", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    const bId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: bId,
    });

    // Active path should be empty (new fork has no stages)
    expect(getActivePath(state)).toHaveLength(0);
  });

  test("original fork is preserved after creating a new fork", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    const originalForkId = state.activeForkId;

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: state.cursorStageId!,
    });

    // Original fork should still have its stages
    const originalFork = state.forks.get(originalForkId)!;
    expect(originalFork.stageIds).toHaveLength(2);
  });

  test("multiple forks can be created", () => {
    state = addStage(state, "a");
    const stageId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "fork-1",
      atStageId: stageId,
    });
    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "fork-2",
      atStageId: stageId,
    });

    expect(state.forks.size).toBe(3);
  });

  test("CREATE_FORK is undoable", () => {
    state = addStage(state, "a");
    const originalForkId = state.activeForkId;

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: state.cursorStageId!,
    });
    expect(state.forks.size).toBe(2);

    state = pipelineReducer(state, { type: "UNDO" });
    expect(state.forks.size).toBe(1);
    expect(state.activeForkId).toBe(originalForkId);
  });
});

// ── DELETE_FORK ──────────────────────────────────────────────────

describe("DELETE_FORK", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("deletes a non-main fork", () => {
    state = addStage(state, "a");
    const originalForkId = state.activeForkId;

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: state.cursorStageId!,
    });
    const branchForkId = state.activeForkId;

    // Add a stage to the new fork
    state = addStage(state, "b");

    state = pipelineReducer(state, {
      type: "DELETE_FORK",
      forkId: branchForkId,
    });

    expect(state.forks.size).toBe(1);
    expect(state.forks.has(branchForkId)).toBe(false);
    expect(state.activeForkId).toBe(originalForkId);
  });

  test("deleting a fork removes its stages from the stages map", () => {
    state = addStage(state, "a");

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: state.cursorStageId!,
    });
    const branchForkId = state.activeForkId;

    // Add stages to the branch
    state = addStage(state, "b");
    state = addStage(state, "c");
    const stageCountBefore = state.stages.size;

    state = pipelineReducer(state, {
      type: "DELETE_FORK",
      forkId: branchForkId,
    });

    // The branch stages should be removed
    expect(state.stages.size).toBe(stageCountBefore - 2);
  });

  test("cannot delete the main fork (no parent)", () => {
    const before = state;

    state = pipelineReducer(state, {
      type: "DELETE_FORK",
      forkId: state.activeForkId,
    });

    // Should be no-op
    expect(state).toBe(before);
    expect(state.forks.has(state.activeForkId)).toBe(true);
  });

  test("DELETE_FORK sets cursor to null", () => {
    state = addStage(state, "a");

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: state.cursorStageId!,
    });
    const branchForkId = state.activeForkId;
    state = addStage(state, "b");
    expect(state.cursorStageId).not.toBeNull();

    state = pipelineReducer(state, {
      type: "DELETE_FORK",
      forkId: branchForkId,
    });

    expect(state.cursorStageId).toBeNull();
  });

  test("DELETE_FORK is undoable", () => {
    state = addStage(state, "a");

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: state.cursorStageId!,
    });
    const branchForkId = state.activeForkId;
    state = addStage(state, "b");

    state = pipelineReducer(state, {
      type: "DELETE_FORK",
      forkId: branchForkId,
    });
    expect(state.forks.size).toBe(1);

    state = pipelineReducer(state, { type: "UNDO" });
    expect(state.forks.size).toBe(2);
    expect(state.forks.has(branchForkId)).toBe(true);
  });

  test("deleting nonexistent fork is no-op", () => {
    const before = state;
    state = pipelineReducer(state, {
      type: "DELETE_FORK",
      forkId: "nonexistent",
    });
    expect(state).toBe(before);
  });
});

// ── SWITCH_FORK ─────────────────────────────────────────────────

describe("SWITCH_FORK", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("switches active fork", () => {
    state = addStage(state, "a");
    const mainForkId = state.activeForkId;

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: state.cursorStageId!,
    });
    const branchForkId = state.activeForkId;

    // Switch back to main
    state = pipelineReducer(state, {
      type: "SWITCH_FORK",
      forkId: mainForkId,
    });
    expect(state.activeForkId).toBe(mainForkId);

    // Switch to branch
    state = pipelineReducer(state, {
      type: "SWITCH_FORK",
      forkId: branchForkId,
    });
    expect(state.activeForkId).toBe(branchForkId);
  });

  test("switching fork resets cursor to null", () => {
    state = addStage(state, "a");
    const mainForkId = state.activeForkId;
    expect(state.cursorStageId).not.toBeNull();

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: state.cursorStageId!,
    });

    // Switch back to main
    state = pipelineReducer(state, {
      type: "SWITCH_FORK",
      forkId: mainForkId,
    });
    expect(state.cursorStageId).toBeNull();
  });

  test("getActivePath returns stages from the active fork", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    const mainForkId = state.activeForkId;

    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: state.cursorStageId!,
    });
    state = addStage(state, "c");

    // Active fork is branch — path should have 1 stage
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "c",
    ]);

    // Switch back to main
    state = pipelineReducer(state, {
      type: "SWITCH_FORK",
      forkId: mainForkId,
    });
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "a",
      "b",
    ]);
  });
});

// ── Fork-aware caching ──────────────────────────────────────────

describe("Fork-aware caching", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("cache entries from one fork are separate from another", () => {
    state = addStage(state, "grep");
    const grepId = state.cursorStageId!;
    const mainForkId = state.activeForkId;

    // Cache a result for grep in main fork
    state = pipelineReducer(state, {
      type: "CACHE_RESULT",
      inputId: state.activeInputId,
      stageId: grepId,
      result: {
        key: `${state.activeInputId}:${grepId}`,
        stageId: grepId,
        inputId: state.activeInputId,
        records: [],
        spillFile: null,
        recordCount: 5,
        fieldNames: ["x"],
        computedAt: Date.now(),
        sizeBytes: 100,
        computeTimeMs: 5,
      },
    });

    expect(getStageOutput(state, grepId)).toBeDefined();

    // Create a branch and add a different stage
    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: grepId,
    });
    state = addStage(state, "sort");
    const sortId = state.cursorStageId!;

    // Sort in the branch should NOT have cached output
    expect(getStageOutput(state, sortId)).toBeUndefined();

    // Switch back to main — grep cache should still be there
    state = pipelineReducer(state, {
      type: "SWITCH_FORK",
      forkId: mainForkId,
    });
    expect(getStageOutput(state, grepId)).toBeDefined();
  });

  test("toggling a stage in one fork does not affect another fork's cache", () => {
    state = addStage(state, "a");
    const aId = state.cursorStageId!;
    state = addStage(state, "b");
    const bId = state.cursorStageId!;
    const mainForkId = state.activeForkId;

    // Cache both stages
    for (const id of [aId, bId]) {
      state = pipelineReducer(state, {
        type: "CACHE_RESULT",
        inputId: state.activeInputId,
        stageId: id,
        result: {
          key: `${state.activeInputId}:${id}`,
          stageId: id,
          inputId: state.activeInputId,
          records: [],
          spillFile: null,
          recordCount: 5,
          fieldNames: ["x"],
          computedAt: Date.now(),
          sizeBytes: 100,
          computeTimeMs: 5,
        },
      });
    }

    // Create a branch
    state = pipelineReducer(state, {
      type: "CREATE_FORK",
      name: "branch",
      atStageId: bId,
    });
    state = addStage(state, "c");
    const cId = state.cursorStageId!;

    // Cache the branch stage
    state = pipelineReducer(state, {
      type: "CACHE_RESULT",
      inputId: state.activeInputId,
      stageId: cId,
      result: {
        key: `${state.activeInputId}:${cId}`,
        stageId: cId,
        inputId: state.activeInputId,
        records: [],
        spillFile: null,
        recordCount: 3,
        fieldNames: ["x"],
        computedAt: Date.now(),
        sizeBytes: 50,
        computeTimeMs: 2,
      },
    });

    // Switch to main and toggle stage a — invalidates a and b in main fork
    state = pipelineReducer(state, {
      type: "SWITCH_FORK",
      forkId: mainForkId,
    });
    state = pipelineReducer(state, { type: "TOGGLE_STAGE", stageId: aId });

    // Main fork caches should be invalidated
    expect(getStageOutput(state, aId)).toBeUndefined();
    expect(getStageOutput(state, bId)).toBeUndefined();

    // Branch stage cache should still be intact (different key)
    expect(state.cache.has(`${state.activeInputId}:${cId}`)).toBe(true);
  });
});

// ── ADD_INPUT / REMOVE_INPUT ────────────────────────────────────

describe("ADD_INPUT / REMOVE_INPUT", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("ADD_INPUT creates a new input and switches to it", () => {
    const oldInputId = state.activeInputId;

    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "test-input",
    });

    expect(state.inputs.size).toBe(1);
    expect(state.activeInputId).not.toBe(oldInputId);
  });

  test("ADD_INPUT with file source", () => {
    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: "/tmp/data.jsonl" },
      label: "data.jsonl",
    });

    const input = state.inputs.get(state.activeInputId)!;
    expect(input.source.kind).toBe("file");
    expect(input.label).toBe("data.jsonl");
  });

  test("ADD_INPUT is undoable", () => {
    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "test",
    });
    expect(state.inputs.size).toBe(1);

    state = pipelineReducer(state, { type: "UNDO" });
    expect(state.inputs.size).toBe(0);
  });

  test("REMOVE_INPUT removes an input", () => {
    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "input-1",
    });
    const input1Id = state.activeInputId;

    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "input-2",
    });
    expect(state.inputs.size).toBe(2);

    state = pipelineReducer(state, {
      type: "REMOVE_INPUT",
      inputId: input1Id,
    });
    expect(state.inputs.size).toBe(1);
    expect(state.inputs.has(input1Id)).toBe(false);
  });

  test("REMOVE_INPUT is no-op when only one input remains", () => {
    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "only-input",
    });
    const inputId = state.activeInputId;
    const before = state;

    state = pipelineReducer(state, {
      type: "REMOVE_INPUT",
      inputId: inputId,
    });
    expect(state).toBe(before);
  });

  test("REMOVE_INPUT switches activeInputId if the active one is removed", () => {
    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "input-1",
    });
    const input1Id = state.activeInputId;

    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "input-2",
    });
    const input2Id = state.activeInputId;

    // Remove active input
    state = pipelineReducer(state, {
      type: "REMOVE_INPUT",
      inputId: input2Id,
    });

    expect(state.activeInputId).toBe(input1Id);
  });
});
