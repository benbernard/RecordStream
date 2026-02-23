import { describe, test, expect, beforeEach } from "bun:test";
import {
  pipelineReducer,
  createInitialState,
} from "../../../src/explorer/model/reducer.ts";
import type {
  PipelineState,
  StageConfig,
} from "../../../src/explorer/model/types.ts";
import {
  getActivePath,
  isDownstreamOfError,
  getStageOutput,
  getDownstreamStages,
} from "../../../src/explorer/model/selectors.ts";
import { extractSnapshot, describeAction } from "../../../src/explorer/model/undo.ts";

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

function getStageIds(state: PipelineState): string[] {
  const fork = state.forks.get(state.activeForkId)!;
  return fork.stageIds;
}

describe("pipelineReducer", () => {
  let state: PipelineState;

  beforeEach(() => {
    state = createInitialState();
  });

  // ── ADD_STAGE ───────────────────────────────────────────────

  describe("ADD_STAGE", () => {
    test("adds first stage to empty pipeline", () => {
      state = addStage(state, "grep", ["status=200"]);
      const path = getActivePath(state);
      expect(path).toHaveLength(1);
      expect(path[0]!.config.operationName).toBe("grep");
      expect(path[0]!.config.args).toEqual(["status=200"]);
      expect(state.cursorStageId).toBe(path[0]!.id);
    });

    test("adds multiple stages in order", () => {
      state = addStage(state, "fromre");
      state = addStage(state, "grep");
      state = addStage(state, "sort");

      const path = getActivePath(state);
      expect(path).toHaveLength(3);
      expect(path.map((s) => s.config.operationName)).toEqual([
        "fromre",
        "grep",
        "sort",
      ]);
    });

    test("adds stage after specific stage (not at end)", () => {
      state = addStage(state, "fromre");
      const firstId = state.cursorStageId!;
      state = addStage(state, "sort"); // cursor is now on sort

      // Insert between fromre and sort
      state = pipelineReducer(state, {
        type: "ADD_STAGE",
        afterStageId: firstId,
        config: makeConfig("grep"),
      });

      const names = getActivePath(state).map((s) => s.config.operationName);
      expect(names).toEqual(["fromre", "grep", "sort"]);
    });

    test("maintains parent/child links", () => {
      state = addStage(state, "fromre");
      state = addStage(state, "grep");
      state = addStage(state, "sort");

      const path = getActivePath(state);
      const [first, second, third] = path;

      expect(first!.parentId).toBeNull();
      expect(first!.childIds).toContain(second!.id);

      expect(second!.parentId).toBe(first!.id);
      expect(second!.childIds).toContain(third!.id);

      expect(third!.parentId).toBe(second!.id);
      expect(third!.childIds).toHaveLength(0);
    });

    test("positions are sequential", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");
      state = addStage(state, "c");

      const positions = getActivePath(state).map((s) => s.position);
      expect(positions).toEqual([0, 1, 2]);
    });
  });

  // ── DELETE_STAGE ────────────────────────────────────────────

  describe("DELETE_STAGE", () => {
    test("removes stage from pipeline", () => {
      state = addStage(state, "fromre");
      state = addStage(state, "grep");
      state = addStage(state, "sort");

      const grepId = getActivePath(state)[1]!.id;
      state = pipelineReducer(state, {
        type: "DELETE_STAGE",
        stageId: grepId,
      });

      const names = getActivePath(state).map((s) => s.config.operationName);
      expect(names).toEqual(["fromre", "sort"]);
    });

    test("re-links parent and child on deletion", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");
      state = addStage(state, "c");

      const bId = getActivePath(state)[1]!.id;
      state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: bId });

      const path = getActivePath(state);
      expect(path[0]!.childIds).toContain(path[1]!.id);
      expect(path[1]!.parentId).toBe(path[0]!.id);
    });

    test("moves cursor to neighbor on deletion", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");
      state = addStage(state, "c");

      const cId = getActivePath(state)[2]!.id;
      state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: cId });

      // Cursor should move to the last remaining stage
      const lastStage = getActivePath(state).at(-1)!;
      expect(state.cursorStageId).toBe(lastStage.id);
    });

    test("sets cursor to null when last stage is deleted", () => {
      state = addStage(state, "a");
      const id = state.cursorStageId!;
      state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: id });

      expect(state.cursorStageId).toBeNull();
      expect(getActivePath(state)).toHaveLength(0);
    });

    test("clears error if error stage is deleted", () => {
      state = addStage(state, "a");
      const id = state.cursorStageId!;
      state = pipelineReducer(state, {
        type: "SET_ERROR",
        stageId: id,
        message: "bad",
      });
      expect(state.lastError).not.toBeNull();

      state = pipelineReducer(state, { type: "DELETE_STAGE", stageId: id });
      expect(state.lastError).toBeNull();
    });

    test("no-op for nonexistent stageId", () => {
      state = addStage(state, "a");
      const before = state;
      state = pipelineReducer(state, {
        type: "DELETE_STAGE",
        stageId: "nonexistent",
      });
      expect(state).toBe(before);
    });
  });

  // ── REORDER_STAGE (move) ────────────────────────────────────

  describe("REORDER_STAGE", () => {
    test("moves stage up", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");
      state = addStage(state, "c");

      const cId = getActivePath(state)[2]!.id;
      state = pipelineReducer(state, {
        type: "REORDER_STAGE",
        stageId: cId,
        direction: "up",
      });

      const names = getActivePath(state).map((s) => s.config.operationName);
      expect(names).toEqual(["a", "c", "b"]);
    });

    test("moves stage down", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");
      state = addStage(state, "c");

      const aId = getActivePath(state)[0]!.id;
      state = pipelineReducer(state, {
        type: "REORDER_STAGE",
        stageId: aId,
        direction: "down",
      });

      const names = getActivePath(state).map((s) => s.config.operationName);
      expect(names).toEqual(["b", "a", "c"]);
    });

    test("no-op when moving first stage up", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");

      const aId = getActivePath(state)[0]!.id;
      state = pipelineReducer(state, {
        type: "REORDER_STAGE",
        stageId: aId,
        direction: "up",
      });
      const names = getActivePath(state).map((s) => s.config.operationName);
      expect(names).toEqual(["a", "b"]);
    });

    test("no-op when moving last stage down", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");

      const bId = getActivePath(state)[1]!.id;
      state = pipelineReducer(state, {
        type: "REORDER_STAGE",
        stageId: bId,
        direction: "down",
      });

      const names = getActivePath(state).map((s) => s.config.operationName);
      expect(names).toEqual(["a", "b"]);
    });

    test("positions and links are correct after move", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");
      state = addStage(state, "c");

      const bId = getActivePath(state)[1]!.id;
      state = pipelineReducer(state, {
        type: "REORDER_STAGE",
        stageId: bId,
        direction: "up",
      });

      const path = getActivePath(state);
      expect(path.map((s) => s.position)).toEqual([0, 1, 2]);
      expect(path[0]!.parentId).toBeNull();
      expect(path[0]!.childIds).toContain(path[1]!.id);
      expect(path[2]!.childIds).toHaveLength(0);
    });
  });

  // ── TOGGLE_STAGE ────────────────────────────────────────────

  describe("TOGGLE_STAGE", () => {
    test("disables an enabled stage", () => {
      state = addStage(state, "grep");
      const id = state.cursorStageId!;

      expect(state.stages.get(id)!.config.enabled).toBe(true);
      state = pipelineReducer(state, { type: "TOGGLE_STAGE", stageId: id });
      expect(state.stages.get(id)!.config.enabled).toBe(false);
    });

    test("re-enables a disabled stage", () => {
      state = addStage(state, "grep");
      const id = state.cursorStageId!;

      state = pipelineReducer(state, { type: "TOGGLE_STAGE", stageId: id });
      state = pipelineReducer(state, { type: "TOGGLE_STAGE", stageId: id });
      expect(state.stages.get(id)!.config.enabled).toBe(true);
    });

    test("invalidates cache for toggled stage and downstream stages", () => {
      state = addStage(state, "fromre");
      const fromreId = state.cursorStageId!;
      state = addStage(state, "grep");
      const grepId = state.cursorStageId!;
      state = addStage(state, "sort");
      const sortId = state.cursorStageId!;

      // Populate cache
      const makeCacheResult = (stageId: string) => ({
        key: `key-${stageId}`,
        stageId,
        inputId: state.activeInputId,
        records: [],
        spillFile: null,
        recordCount: 10,
        fieldNames: ["a"],
        computedAt: Date.now(),
        sizeBytes: 100,
        computeTimeMs: 5,
      });

      for (const id of [fromreId, grepId, sortId]) {
        state = pipelineReducer(state, {
          type: "CACHE_RESULT",
          inputId: state.activeInputId,
          stageId: id,
          result: makeCacheResult(id),
        });
      }

      expect(state.cache.size).toBe(3);

      // Toggle grep — should invalidate grep + sort, but NOT fromre
      state = pipelineReducer(state, { type: "TOGGLE_STAGE", stageId: grepId });

      expect(getStageOutput(state, fromreId)).toBeDefined();
      expect(getStageOutput(state, grepId)).toBeUndefined();
      expect(getStageOutput(state, sortId)).toBeUndefined();
    });
  });

  // ── UPDATE_STAGE_ARGS ───────────────────────────────────────

  describe("UPDATE_STAGE_ARGS", () => {
    test("updates args on existing stage", () => {
      state = addStage(state, "grep", ["status=200"]);
      const id = state.cursorStageId!;

      state = pipelineReducer(state, {
        type: "UPDATE_STAGE_ARGS",
        stageId: id,
        args: ["status=404"],
      });

      expect(state.stages.get(id)!.config.args).toEqual(["status=404"]);
    });

    test("invalidates cache for modified stage and downstream stages", () => {
      state = addStage(state, "fromre");
      const fromreId = state.cursorStageId!;
      state = addStage(state, "grep", ["status=200"]);
      const grepId = state.cursorStageId!;
      state = addStage(state, "sort");
      const sortId = state.cursorStageId!;

      // Populate cache for all stages
      const makeCacheResult = (stageId: string) => ({
        key: `key-${stageId}`,
        stageId,
        inputId: state.activeInputId,
        records: [],
        spillFile: null,
        recordCount: 10,
        fieldNames: ["a"],
        computedAt: Date.now(),
        sizeBytes: 100,
        computeTimeMs: 5,
      });

      state = pipelineReducer(state, {
        type: "CACHE_RESULT",
        inputId: state.activeInputId,
        stageId: fromreId,
        result: makeCacheResult(fromreId),
      });
      state = pipelineReducer(state, {
        type: "CACHE_RESULT",
        inputId: state.activeInputId,
        stageId: grepId,
        result: makeCacheResult(grepId),
      });
      state = pipelineReducer(state, {
        type: "CACHE_RESULT",
        inputId: state.activeInputId,
        stageId: sortId,
        result: makeCacheResult(sortId),
      });

      expect(state.cache.size).toBe(3);

      // Update grep args — should invalidate grep + sort (downstream), but NOT fromre (upstream)
      state = pipelineReducer(state, {
        type: "UPDATE_STAGE_ARGS",
        stageId: grepId,
        args: ["status=404"],
      });

      expect(getStageOutput(state, fromreId)).toBeDefined();
      expect(getStageOutput(state, grepId)).toBeUndefined();
      expect(getStageOutput(state, sortId)).toBeUndefined();
    });
  });

  // ── UNDO / REDO ─────────────────────────────────────────────

  describe("Undo/Redo", () => {
    test("undo restores previous state after ADD_STAGE", () => {
      state = addStage(state, "grep");
      expect(getActivePath(state)).toHaveLength(1);

      state = pipelineReducer(state, { type: "UNDO" });
      expect(getActivePath(state)).toHaveLength(0);
    });

    test("redo restores undone state", () => {
      state = addStage(state, "grep");
      state = pipelineReducer(state, { type: "UNDO" });
      expect(getActivePath(state)).toHaveLength(0);

      state = pipelineReducer(state, { type: "REDO" });
      expect(getActivePath(state)).toHaveLength(1);
      expect(getActivePath(state)[0]!.config.operationName).toBe("grep");
    });

    test("redo stack clears on new structural action", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");

      // Undo "add b" -> redo stack has 1 entry
      state = pipelineReducer(state, { type: "UNDO" });
      expect(state.redoStack).toHaveLength(1);

      // New action clears redo
      state = addStage(state, "c");
      expect(state.redoStack).toHaveLength(0);
    });

    test("undo is no-op when stack is empty", () => {
      const before = state;
      const after = pipelineReducer(state, { type: "UNDO" });
      expect(after).toBe(before);
    });

    test("redo is no-op when stack is empty", () => {
      const before = state;
      const after = pipelineReducer(state, { type: "REDO" });
      expect(after).toBe(before);
    });

    test("multiple undo/redo cycle works correctly", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");
      state = addStage(state, "c");
      expect(getActivePath(state)).toHaveLength(3);

      // Undo all three additions
      state = pipelineReducer(state, { type: "UNDO" }); // remove c
      expect(getActivePath(state)).toHaveLength(2);

      state = pipelineReducer(state, { type: "UNDO" }); // remove b
      expect(getActivePath(state)).toHaveLength(1);

      state = pipelineReducer(state, { type: "UNDO" }); // remove a
      expect(getActivePath(state)).toHaveLength(0);

      // Redo all three
      state = pipelineReducer(state, { type: "REDO" });
      expect(getActivePath(state)).toHaveLength(1);

      state = pipelineReducer(state, { type: "REDO" });
      expect(getActivePath(state)).toHaveLength(2);

      state = pipelineReducer(state, { type: "REDO" });
      expect(getActivePath(state)).toHaveLength(3);
    });

    test("undo stack is capped at 200 entries", () => {
      for (let i = 0; i < 210; i++) {
        state = addStage(state, `op-${i}`);
      }
      expect(state.undoStack.length).toBeLessThanOrEqual(200);
      // Should still have all 210 stages (cap only limits undo history, not stages)
      expect(getActivePath(state)).toHaveLength(210);
    });

    test("undo restores cursor position", () => {
      state = addStage(state, "a");
      const aId = state.cursorStageId!;

      state = addStage(state, "b");
      expect(state.cursorStageId).not.toBe(aId);

      state = pipelineReducer(state, { type: "UNDO" });
      expect(state.cursorStageId).toBe(aId);
    });

    test("undo restores toggle state", () => {
      state = addStage(state, "grep");
      const id = state.cursorStageId!;

      state = pipelineReducer(state, { type: "TOGGLE_STAGE", stageId: id });
      expect(state.stages.get(id)!.config.enabled).toBe(false);

      state = pipelineReducer(state, { type: "UNDO" });
      expect(state.stages.get(id)!.config.enabled).toBe(true);
    });

    test("non-undoable actions do not push to undo stack", () => {
      state = addStage(state, "a");
      const stackLen = state.undoStack.length;

      state = pipelineReducer(state, { type: "TOGGLE_FOCUS" });
      expect(state.undoStack.length).toBe(stackLen);

      state = pipelineReducer(state, {
        type: "SET_EXECUTING",
        executing: true,
      });
      expect(state.undoStack.length).toBe(stackLen);
    });
  });

  // ── Error propagation ───────────────────────────────────────

  describe("Error propagation", () => {
    test("SET_ERROR sets lastError", () => {
      state = addStage(state, "grep");
      const id = state.cursorStageId!;

      state = pipelineReducer(state, {
        type: "SET_ERROR",
        stageId: id,
        message: "Invalid expression",
      });

      expect(state.lastError).toEqual({
        stageId: id,
        message: "Invalid expression",
      });
    });

    test("CLEAR_ERROR clears lastError", () => {
      state = addStage(state, "grep");
      state = pipelineReducer(state, {
        type: "SET_ERROR",
        stageId: state.cursorStageId!,
        message: "bad",
      });
      state = pipelineReducer(state, { type: "CLEAR_ERROR" });
      expect(state.lastError).toBeNull();
    });

    test("isDownstreamOfError identifies downstream stages", () => {
      state = addStage(state, "a");
      const aId = state.cursorStageId!;
      state = addStage(state, "b");
      const bId = state.cursorStageId!;
      state = addStage(state, "c");
      const cId = state.cursorStageId!;

      state = pipelineReducer(state, {
        type: "SET_ERROR",
        stageId: aId,
        message: "fail",
      });

      expect(isDownstreamOfError(state, aId)).toBe(false);
      expect(isDownstreamOfError(state, bId)).toBe(true);
      expect(isDownstreamOfError(state, cId)).toBe(true);
    });

    test("isDownstreamOfError returns false when no error", () => {
      state = addStage(state, "a");
      const id = state.cursorStageId!;
      expect(isDownstreamOfError(state, id)).toBe(false);
    });
  });

  // ── Selectors ───────────────────────────────────────────────

  describe("Selectors", () => {
    test("getActivePath returns stages in order", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");
      state = addStage(state, "c");

      const path = getActivePath(state);
      expect(path.map((s) => s.config.operationName)).toEqual(["a", "b", "c"]);
    });

    test("getStageOutput returns cached result", () => {
      state = addStage(state, "grep");
      const id = state.cursorStageId!;

      expect(getStageOutput(state, id)).toBeUndefined();

      const result = {
        key: "abc",
        stageId: id,
        inputId: state.activeInputId,
        records: [],
        spillFile: null,
        recordCount: 5,
        fieldNames: ["ip", "status"],
        computedAt: Date.now(),
        sizeBytes: 100,
        computeTimeMs: 10,
      };

      state = pipelineReducer(state, {
        type: "CACHE_RESULT",
        inputId: state.activeInputId,
        stageId: id,
        result,
      });

      expect(getStageOutput(state, id)).toEqual(result);
    });

    test("getDownstreamStages returns correct stages", () => {
      state = addStage(state, "a");
      const aId = state.cursorStageId!;
      state = addStage(state, "b");
      state = addStage(state, "c");

      const downstream = getDownstreamStages(state, aId);
      expect(downstream.map((s) => s.config.operationName)).toEqual([
        "b",
        "c",
      ]);
    });
  });

  // ── Cursor movement ─────────────────────────────────────────

  describe("MOVE_CURSOR", () => {
    test("moves cursor down through stages", () => {
      state = addStage(state, "a");
      const aId = state.cursorStageId!;
      state = addStage(state, "b");
      const bId = state.cursorStageId!;
      state = addStage(state, "c");

      // Set cursor to start
      state = pipelineReducer(state, { type: "SET_CURSOR", stageId: aId });
      expect(state.cursorStageId).toBe(aId);

      state = pipelineReducer(state, {
        type: "MOVE_CURSOR",
        direction: "down",
      });
      expect(state.cursorStageId).toBe(bId);
    });

    test("clamps cursor at boundaries", () => {
      state = addStage(state, "a");
      state = addStage(state, "b");

      const stageIds = getStageIds(state);

      // Set to first, move up — stays at first
      state = pipelineReducer(state, {
        type: "SET_CURSOR",
        stageId: stageIds[0]!,
      });
      state = pipelineReducer(state, {
        type: "MOVE_CURSOR",
        direction: "up",
      });
      expect(state.cursorStageId).toBe(stageIds[0]!);

      // Set to last, move down — stays at last
      state = pipelineReducer(state, {
        type: "SET_CURSOR",
        stageId: stageIds[1]!,
      });
      state = pipelineReducer(state, {
        type: "MOVE_CURSOR",
        direction: "down",
      });
      expect(state.cursorStageId).toBe(stageIds[1]!);
    });
  });

  // ── Undo helper tests ──────────────────────────────────────

  describe("extractSnapshot / describeAction", () => {
    test("extractSnapshot creates deep copy of maps", () => {
      state = addStage(state, "grep");
      const snapshot = extractSnapshot(state);

      // Mutating state's maps should not affect snapshot
      state.stages.clear();
      expect(snapshot.stages.size).toBe(1);
    });

    test("describeAction returns human-readable labels", () => {
      expect(
        describeAction({
          type: "ADD_STAGE",
          afterStageId: null,
          config: makeConfig("grep"),
        }),
      ).toBe("Add grep stage");

      expect(
        describeAction({ type: "DELETE_STAGE", stageId: "x" }),
      ).toBe("Delete stage");

      expect(
        describeAction({
          type: "REORDER_STAGE",
          stageId: "x",
          direction: "up",
        }),
      ).toBe("Move stage up");
    });
  });

  // ── INSERT_STAGE_BEFORE ─────────────────────────────────────

  describe("INSERT_STAGE_BEFORE", () => {
    test("inserts stage before the specified stage", () => {
      state = addStage(state, "a");
      state = addStage(state, "c");
      const cId = state.cursorStageId!;

      state = pipelineReducer(state, {
        type: "INSERT_STAGE_BEFORE",
        beforeStageId: cId,
        config: makeConfig("b"),
      });

      const names = getActivePath(state).map((s) => s.config.operationName);
      expect(names).toEqual(["a", "b", "c"]);
    });
  });

  // ── TOGGLE_FOCUS ────────────────────────────────────────────

  describe("TOGGLE_FOCUS", () => {
    test("toggles between pipeline and inspector", () => {
      expect(state.focusedPanel).toBe("pipeline");
      state = pipelineReducer(state, { type: "TOGGLE_FOCUS" });
      expect(state.focusedPanel).toBe("inspector");
      state = pipelineReducer(state, { type: "TOGGLE_FOCUS" });
      expect(state.focusedPanel).toBe("pipeline");
    });
  });
});
