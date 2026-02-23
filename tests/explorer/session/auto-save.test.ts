import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createAutoSave } from "../../../src/explorer/session/auto-save.ts";
import { SessionManager } from "../../../src/explorer/session/session-manager.ts";
import {
  createInitialState,
  pipelineReducer,
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

describe("createAutoSave", () => {
  let tempDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "recs-autosave-test-"));
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("saveNow writes session to disk immediately", async () => {
    const controller = createAutoSave(manager, {
      intervalMs: 60_000, // long interval to prevent interference
      debounceMs: 60_000,
    });

    let state = createInitialState();
    state = addStage(state, "grep", ["status=200"]);

    await controller.saveNow(state);
    controller.dispose();

    const sessions = await manager.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.sessionId).toBe(state.sessionId);
  });

  test("onAction marks dirty on structural actions", async () => {
    const controller = createAutoSave(manager, {
      intervalMs: 60_000,
      debounceMs: 100, // short debounce for testing
    });

    let state = createInitialState();
    state = addStage(state, "grep");

    // Notify auto-save of the structural action
    controller.onAction(
      {
        type: "ADD_STAGE",
        afterStageId: null,
        config: makeConfig("grep"),
      },
      state,
    );

    // Wait for debounce to fire
    await new Promise((r) => setTimeout(r, 200));
    controller.dispose();

    const sessions = await manager.list();
    expect(sessions).toHaveLength(1);
  });

  test("onAction does NOT trigger save for non-structural actions", async () => {
    const controller = createAutoSave(manager, {
      intervalMs: 60_000,
      debounceMs: 50,
    });

    let state = createInitialState();
    state = addStage(state, "grep");

    // Dispatch a non-structural action
    controller.onAction({ type: "TOGGLE_FOCUS" }, state);

    // Wait beyond the debounce period
    await new Promise((r) => setTimeout(r, 150));
    controller.dispose();

    // No save should have occurred
    const sessions = await manager.list();
    expect(sessions).toHaveLength(0);
  });

  test("dispose cancels pending timers", async () => {
    const controller = createAutoSave(manager, {
      intervalMs: 100,
      debounceMs: 100,
    });

    let state = createInitialState();
    state = addStage(state, "grep");

    controller.onAction(
      {
        type: "ADD_STAGE",
        afterStageId: null,
        config: makeConfig("grep"),
      },
      state,
    );

    // Dispose before debounce fires
    controller.dispose();

    // Wait to verify no save happens
    await new Promise((r) => setTimeout(r, 200));

    const sessions = await manager.list();
    expect(sessions).toHaveLength(0);
  });

  test("debounced save consolidates rapid structural changes", async () => {
    const controller = createAutoSave(manager, {
      intervalMs: 60_000,
      debounceMs: 100,
    });

    let state = createInitialState();
    state = addStage(state, "grep");
    controller.onAction(
      {
        type: "ADD_STAGE",
        afterStageId: null,
        config: makeConfig("grep"),
      },
      state,
    );

    state = addStage(state, "sort");
    controller.onAction(
      {
        type: "ADD_STAGE",
        afterStageId: state.cursorStageId,
        config: makeConfig("sort"),
      },
      state,
    );

    state = addStage(state, "totable");
    controller.onAction(
      {
        type: "ADD_STAGE",
        afterStageId: state.cursorStageId,
        config: makeConfig("totable"),
      },
      state,
    );

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 200));
    controller.dispose();

    // Should have saved once with all 3 stages
    const sessions = await manager.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.stageCount).toBe(3);
  });

  test("saveNow cancels pending debounce and saves current state", async () => {
    const controller = createAutoSave(manager, {
      intervalMs: 60_000,
      debounceMs: 500,
    });

    let state = createInitialState();
    state = addStage(state, "grep");

    // Trigger debounced save
    controller.onAction(
      {
        type: "ADD_STAGE",
        afterStageId: null,
        config: makeConfig("grep"),
      },
      state,
    );

    // Immediately save (should cancel the pending debounce)
    state = addStage(state, "sort");
    await controller.saveNow(state);
    controller.dispose();

    const sessions = await manager.list();
    expect(sessions).toHaveLength(1);
    // Should have 2 stages (from saveNow state, not debounced state)
    expect(sessions[0]!.stageCount).toBe(2);
  });

  test("interval save triggers after intervalMs when dirty", async () => {
    const controller = createAutoSave(manager, {
      intervalMs: 100,
      debounceMs: 60_000, // long debounce to prevent interference
    });

    let state = createInitialState();
    state = addStage(state, "grep");

    // Mark as dirty via structural action
    controller.onAction(
      {
        type: "ADD_STAGE",
        afterStageId: null,
        config: makeConfig("grep"),
      },
      state,
    );

    // Wait for interval to fire
    await new Promise((r) => setTimeout(r, 250));
    controller.dispose();

    const sessions = await manager.list();
    expect(sessions).toHaveLength(1);
  });
});
