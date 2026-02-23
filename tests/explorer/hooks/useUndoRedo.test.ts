/**
 * Tests for useUndoRedo derived state.
 *
 * Since useUndoRedo is a thin useMemo wrapper, we test the logic
 * by computing the same derived values directly from PipelineState
 * rather than requiring React Testing Library.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  pipelineReducer,
  createInitialState,
} from "../../../src/explorer/model/reducer.ts";
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

/**
 * Mirror of useUndoRedo logic — computes derived state from PipelineState.
 */
function computeUndoRedoState(state: PipelineState) {
  const undoCount = state.undoStack.length;
  const redoCount = state.redoStack.length;

  const nextUndoLabel =
    undoCount > 0
      ? (state.undoStack[undoCount - 1]?.label ?? null)
      : null;

  const nextRedoLabel =
    redoCount > 0
      ? (state.redoStack[redoCount - 1]?.label ?? null)
      : null;

  return {
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    undoCount,
    redoCount,
    nextUndoLabel,
    nextRedoLabel,
  };
}

describe("useUndoRedo derived state", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  test("fresh state: cannot undo or redo", () => {
    const result = computeUndoRedoState(state);
    expect(result.canUndo).toBe(false);
    expect(result.canRedo).toBe(false);
    expect(result.undoCount).toBe(0);
    expect(result.redoCount).toBe(0);
    expect(result.nextUndoLabel).toBeNull();
    expect(result.nextRedoLabel).toBeNull();
  });

  test("after one action: can undo, cannot redo", () => {
    state = addStage(state, "grep");

    const result = computeUndoRedoState(state);
    expect(result.canUndo).toBe(true);
    expect(result.canRedo).toBe(false);
    expect(result.undoCount).toBe(1);
    expect(result.nextUndoLabel).toBe("Add grep stage");
  });

  test("after two actions: undoCount is 2", () => {
    state = addStage(state, "grep");
    state = addStage(state, "sort");

    const result = computeUndoRedoState(state);
    expect(result.undoCount).toBe(2);
    expect(result.nextUndoLabel).toBe("Add sort stage");
  });

  test("after undo: can redo, nextRedoLabel shows undone action", () => {
    state = addStage(state, "grep");
    state = addStage(state, "sort");

    state = pipelineReducer(state, { type: "UNDO" });

    const result = computeUndoRedoState(state);
    expect(result.canUndo).toBe(true);
    expect(result.canRedo).toBe(true);
    expect(result.undoCount).toBe(1);
    expect(result.redoCount).toBe(1);
    expect(result.nextUndoLabel).toBe("Add grep stage");
    expect(result.nextRedoLabel).toBe("Add sort stage");
  });

  test("after undo all: cannot undo, can redo all", () => {
    state = addStage(state, "grep");
    state = addStage(state, "sort");

    state = pipelineReducer(state, { type: "UNDO" });
    state = pipelineReducer(state, { type: "UNDO" });

    const result = computeUndoRedoState(state);
    expect(result.canUndo).toBe(false);
    expect(result.canRedo).toBe(true);
    expect(result.undoCount).toBe(0);
    expect(result.redoCount).toBe(2);
  });

  test("new action after undo clears redo", () => {
    state = addStage(state, "grep");
    state = addStage(state, "sort");
    state = pipelineReducer(state, { type: "UNDO" });

    // New action should clear redo
    state = addStage(state, "collate");

    const result = computeUndoRedoState(state);
    expect(result.canRedo).toBe(false);
    expect(result.redoCount).toBe(0);
    expect(result.nextRedoLabel).toBeNull();
    expect(result.undoCount).toBe(2);
  });

  test("undo label reflects the most recent structural action", () => {
    state = addStage(state, "grep");
    const id = state.cursorStageId!;
    state = pipelineReducer(state, { type: "TOGGLE_STAGE", stageId: id });

    const result = computeUndoRedoState(state);
    expect(result.nextUndoLabel).toBe("Toggle stage enabled");
  });

  test("DELETE_STAGE shows correct undo label", () => {
    state = addStage(state, "grep");
    state = addStage(state, "sort");
    const sortId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "DELETE_STAGE",
      stageId: sortId,
    });

    const result = computeUndoRedoState(state);
    expect(result.nextUndoLabel).toBe("Delete stage");
  });

  test("UPDATE_STAGE_ARGS shows correct undo label", () => {
    state = addStage(state, "grep", ["status=200"]);
    const id = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: id,
      args: ["status=404"],
    });

    const result = computeUndoRedoState(state);
    expect(result.nextUndoLabel).toBe("Update stage arguments");
  });

  test("REORDER_STAGE shows correct undo label with direction", () => {
    state = addStage(state, "a");
    state = addStage(state, "b");
    const bId = state.cursorStageId!;

    state = pipelineReducer(state, {
      type: "REORDER_STAGE",
      stageId: bId,
      direction: "up",
    });

    const result = computeUndoRedoState(state);
    expect(result.nextUndoLabel).toBe("Move stage up");
  });

  test("non-undoable actions do not change undo/redo counts", () => {
    state = addStage(state, "grep");
    const initial = computeUndoRedoState(state);

    state = pipelineReducer(state, { type: "TOGGLE_FOCUS" });
    const afterFocus = computeUndoRedoState(state);
    expect(afterFocus.undoCount).toBe(initial.undoCount);

    state = pipelineReducer(state, {
      type: "SET_EXECUTING",
      executing: true,
    });
    const afterExec = computeUndoRedoState(state);
    expect(afterExec.undoCount).toBe(initial.undoCount);
  });
});
