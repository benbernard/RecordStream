import { describe, test, expect, beforeEach } from "bun:test";
import {
  extractSnapshot,
  describeAction,
  UNDOABLE_ACTIONS,
  MAX_UNDO_ENTRIES,
} from "../../../src/explorer/model/undo.ts";
import {
  pipelineReducer,
  createInitialState,
} from "../../../src/explorer/model/reducer.ts";
import { getActivePath } from "../../../src/explorer/model/selectors.ts";
import type {
  PipelineState,
  PipelineAction,
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

// ── extractSnapshot ──────────────────────────────────────────────

describe("extractSnapshot", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("creates a deep copy of stages map", () => {
    state = addStage(state, "grep");
    const snapshot = extractSnapshot(state);

    state.stages.clear();
    expect(snapshot.stages.size).toBe(1);
  });

  test("creates a deep copy of forks map", () => {
    state = addStage(state, "grep");
    const snapshot = extractSnapshot(state);

    state.forks.clear();
    expect(snapshot.forks.size).toBe(1);
  });

  test("creates a deep copy of inputs map", () => {
    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "test",
    });
    const snapshot = extractSnapshot(state);

    state.inputs.clear();
    expect(snapshot.inputs.size).toBe(1);
  });

  test("deep-copies childIds arrays on stages", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    const snapshot = extractSnapshot(state);

    // Mutate the original stage's childIds
    const firstStage = Array.from(state.stages.values())[0]!;
    firstStage.childIds.push("fake-id");

    // Snapshot should not be affected
    const snapshotStage = Array.from(snapshot.stages.values())[0]!;
    expect(snapshotStage.childIds).not.toContain("fake-id");
  });

  test("deep-copies stageIds arrays on forks", () => {
    state = addStage(state, "a");
    const snapshot = extractSnapshot(state);

    // Mutate the original fork's stageIds
    const fork = Array.from(state.forks.values())[0]!;
    fork.stageIds.push("fake-id");

    // Snapshot should not be affected
    const snapshotFork = Array.from(snapshot.forks.values())[0]!;
    expect(snapshotFork.stageIds).not.toContain("fake-id");
  });

  test("preserves cursor position", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    const cursorId = state.cursorStageId;

    const snapshot = extractSnapshot(state);
    expect(snapshot.cursorStageId).toBe(cursorId);
  });

  test("preserves activeInputId and activeForkId", () => {
    state = pipelineReducer(state, {
      type: "ADD_INPUT",
      source: { kind: "stdin-capture", records: [] },
      label: "test",
    });
    const snapshot = extractSnapshot(state);

    expect(snapshot.activeInputId).toBe(state.activeInputId);
    expect(snapshot.activeForkId).toBe(state.activeForkId);
  });

  test("snapshot of empty state has empty maps", () => {
    const snapshot = extractSnapshot(state);
    expect(snapshot.stages.size).toBe(0);
    expect(snapshot.cursorStageId).toBeNull();
  });
});

// ── describeAction ───────────────────────────────────────────────

describe("describeAction", () => {
  test("ADD_STAGE includes operation name", () => {
    const result = describeAction({
      type: "ADD_STAGE",
      afterStageId: null,
      config: makeConfig("grep"),
    });
    expect(result).toBe("Add grep stage");
  });

  test("ADD_STAGE with different operation", () => {
    const result = describeAction({
      type: "ADD_STAGE",
      afterStageId: "some-id",
      config: makeConfig("sort", ["--key", "x=n"]),
    });
    expect(result).toBe("Add sort stage");
  });

  test("DELETE_STAGE", () => {
    expect(describeAction({ type: "DELETE_STAGE", stageId: "x" })).toBe(
      "Delete stage",
    );
  });

  test("UPDATE_STAGE_ARGS", () => {
    expect(
      describeAction({
        type: "UPDATE_STAGE_ARGS",
        stageId: "x",
        args: ["new-args"],
      }),
    ).toBe("Update stage arguments");
  });

  test("TOGGLE_STAGE", () => {
    expect(
      describeAction({ type: "TOGGLE_STAGE", stageId: "x" }),
    ).toBe("Toggle stage enabled");
  });

  test("INSERT_STAGE_BEFORE includes operation name", () => {
    expect(
      describeAction({
        type: "INSERT_STAGE_BEFORE",
        beforeStageId: "x",
        config: makeConfig("fromcsv"),
      }),
    ).toBe("Insert fromcsv stage");
  });

  test("CREATE_FORK includes fork name", () => {
    expect(
      describeAction({
        type: "CREATE_FORK",
        name: "experiment-1",
        atStageId: "x",
      }),
    ).toBe('Create fork "experiment-1"');
  });

  test("DELETE_FORK", () => {
    expect(
      describeAction({ type: "DELETE_FORK", forkId: "x" }),
    ).toBe("Delete fork");
  });

  test("ADD_INPUT includes label", () => {
    expect(
      describeAction({
        type: "ADD_INPUT",
        source: { kind: "stdin-capture", records: [] },
        label: "data.jsonl",
      }),
    ).toBe('Add input "data.jsonl"');
  });

  test("REMOVE_INPUT", () => {
    expect(
      describeAction({ type: "REMOVE_INPUT", inputId: "x" }),
    ).toBe("Remove input");
  });

  test("REORDER_STAGE up", () => {
    expect(
      describeAction({
        type: "REORDER_STAGE",
        stageId: "x",
        direction: "up",
      }),
    ).toBe("Move stage up");
  });

  test("REORDER_STAGE down", () => {
    expect(
      describeAction({
        type: "REORDER_STAGE",
        stageId: "x",
        direction: "down",
      }),
    ).toBe("Move stage down");
  });

  test("non-undoable action returns type name", () => {
    expect(
      describeAction({ type: "TOGGLE_FOCUS" } as PipelineAction),
    ).toBe("TOGGLE_FOCUS");
  });
});

// ── UNDOABLE_ACTIONS ──────────────────────────────────────────────

describe("UNDOABLE_ACTIONS", () => {
  test("contains all structural actions", () => {
    const expected = [
      "ADD_STAGE",
      "DELETE_STAGE",
      "UPDATE_STAGE_ARGS",
      "TOGGLE_STAGE",
      "INSERT_STAGE_BEFORE",
      "CREATE_FORK",
      "DELETE_FORK",
      "ADD_INPUT",
      "REMOVE_INPUT",
      "REORDER_STAGE",
    ];
    for (const action of expected) {
      expect(UNDOABLE_ACTIONS.has(action as PipelineAction["type"])).toBe(true);
    }
  });

  test("does not contain non-structural actions", () => {
    const nonUndoable = [
      "UNDO",
      "REDO",
      "MOVE_CURSOR",
      "SET_CURSOR",
      "SWITCH_INPUT",
      "SWITCH_FORK",
      "CACHE_RESULT",
      "INVALIDATE_STAGE",
      "PIN_STAGE",
      "SET_CACHE_POLICY",
      "SET_ERROR",
      "CLEAR_ERROR",
      "SET_EXECUTING",
      "TOGGLE_FOCUS",
      "SET_VIEW_MODE",
      "SET_SESSION_NAME",
    ];
    for (const action of nonUndoable) {
      expect(UNDOABLE_ACTIONS.has(action as PipelineAction["type"])).toBe(
        false,
      );
    }
  });

  test("has exactly 10 entries", () => {
    expect(UNDOABLE_ACTIONS.size).toBe(10);
  });
});

// ── MAX_UNDO_ENTRIES ─────────────────────────────────────────────

describe("MAX_UNDO_ENTRIES", () => {
  test("is 200", () => {
    expect(MAX_UNDO_ENTRIES).toBe(200);
  });
});

// ── Undo/redo edge cases ─────────────────────────────────────────

describe("Undo/redo edge cases", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("undo on empty pipeline is no-op", () => {
    const before = state;
    const after = pipelineReducer(state, { type: "UNDO" });
    expect(after).toBe(before);
    expect(after.undoStack).toHaveLength(0);
    expect(after.redoStack).toHaveLength(0);
  });

  test("redo on empty pipeline is no-op", () => {
    const before = state;
    const after = pipelineReducer(state, { type: "REDO" });
    expect(after).toBe(before);
  });

  test("undo past empty: add stage then undo returns to empty", () => {
    state = addStage(state, "grep");
    expect(getActivePath(state)).toHaveLength(1);

    state = pipelineReducer(state, { type: "UNDO" });
    expect(getActivePath(state)).toHaveLength(0);
    expect(state.cursorStageId).toBeNull();
  });

  test("undo past empty then redo restores stage", () => {
    state = addStage(state, "grep");

    state = pipelineReducer(state, { type: "UNDO" });
    expect(getActivePath(state)).toHaveLength(0);

    state = pipelineReducer(state, { type: "REDO" });
    expect(getActivePath(state)).toHaveLength(1);
    expect(getActivePath(state)[0]!.config.operationName).toBe("grep");
  });

  test("multiple undos past empty: add 3, undo 3", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    state = addStage(state, "c");

    state = pipelineReducer(state, { type: "UNDO" });
    state = pipelineReducer(state, { type: "UNDO" });
    state = pipelineReducer(state, { type: "UNDO" });

    expect(getActivePath(state)).toHaveLength(0);
    expect(state.cursorStageId).toBeNull();

    // Extra undo should be no-op
    const before = state;
    state = pipelineReducer(state, { type: "UNDO" });
    expect(state).toBe(before);
  });

  test("undo + new action clears redo stack", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");

    state = pipelineReducer(state, { type: "UNDO" });
    expect(state.redoStack).toHaveLength(1);

    // New structural action clears redo
    state = addStage(state, "c");
    expect(state.redoStack).toHaveLength(0);

    // Redo should now be no-op
    const before = state;
    state = pipelineReducer(state, { type: "REDO" });
    expect(state).toBe(before);
  });

  test("undo stack is capped at MAX_UNDO_ENTRIES", () => {
    for (let i = 0; i < MAX_UNDO_ENTRIES + 20; i++) {
      state = addStage(state, `op-${i}`);
    }
    expect(state.undoStack.length).toBe(MAX_UNDO_ENTRIES);
    // All stages should still exist — cap only limits undo history
    expect(getActivePath(state)).toHaveLength(MAX_UNDO_ENTRIES + 20);
  });

  test("undo restores stage args after UPDATE_STAGE_ARGS", () => {
    state = addStage(state, "grep", ["status=200"]);
    const id = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: id,
      args: ["status=404"],
    });
    expect(state.stages.get(id)!.config.args).toEqual(["status=404"]);

    state = pipelineReducer(state, { type: "UNDO" });
    expect(state.stages.get(id)!.config.args).toEqual(["status=200"]);
  });

  test("undo restores reorder", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    state = addStage(state, "c");

    const bId = getActivePath(state)[1]!.id;
    state = pipelineReducer(state, {
      type: "REORDER_STAGE",
      stageId: bId,
      direction: "up",
    });
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "b",
      "a",
      "c",
    ]);

    state = pipelineReducer(state, { type: "UNDO" });
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("undo DELETE_STAGE restores the stage", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    state = addStage(state, "c");

    const bId = getActivePath(state)[1]!.id;
    state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: bId });
    expect(getActivePath(state)).toHaveLength(2);

    state = pipelineReducer(state, { type: "UNDO" });
    expect(getActivePath(state)).toHaveLength(3);
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("undo INSERT_STAGE_BEFORE restores previous state", () => {
    state = addStage(state, "a");
    state = addStage(state, "c");
    const cId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "INSERT_STAGE_BEFORE",
      beforeStageId: cId,
      config: makeConfig("b"),
    });
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "a",
      "b",
      "c",
    ]);

    state = pipelineReducer(state, { type: "UNDO" });
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "a",
      "c",
    ]);
  });
});
