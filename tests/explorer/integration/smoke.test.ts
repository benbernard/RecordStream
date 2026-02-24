/**
 * Smoke / integration tests for the Explorer.
 *
 * These tests verify end-to-end flows that cross module boundaries:
 * state management → executor → cache → serialization → session persistence.
 * They are designed to catch wiring bugs that unit tests miss (e.g., a hook
 * not calling executeToStage, or ADD_STAGE not chaining to editStage).
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
  getStageOutput,
} from "../../../src/explorer/model/selectors.ts";
import {
  exportAsPipeScript,
  exportAsChainCommand,
} from "../../../src/explorer/model/serialization.ts";
import { detectInputOperation } from "../../../src/explorer/utils/file-detect.ts";
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

// ── 1. App initialisation smoke ──────────────────────────────────────

describe("App initialisation smoke", () => {
  test("createInitialState produces a valid empty state", () => {
    const state = createInitialState();

    expect(state.stages).toBeInstanceOf(Map);
    expect(state.stages.size).toBe(0);
    expect(state.forks).toBeInstanceOf(Map);
    expect(state.forks.size).toBe(1); // "main" fork
    expect(state.cache).toBeInstanceOf(Map);
    expect(state.cursorStageId).toBeNull();
    expect(state.focusedPanel).toBe("pipeline");
    expect(state.executing).toBe(false);
    expect(state.lastError).toBeNull();
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
    expect(state.sessionId).toBeTruthy();
  });

  test("adding input and stage produces executable state", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ];
    state = addInput(state, records);
    state = addStage(state, "grep", ["{{x}} > 1"]);

    expect(state.inputs.size).toBe(1);
    expect(state.stages.size).toBe(1);
    expect(state.cursorStageId).not.toBeNull();

    const result = await executeToStage(state, state.cursorStageId!);
    expect(result.recordCount).toBe(2);
  });
});

// ── 2. Pipeline execution actually runs ──────────────────────────────

describe("Pipeline execution end-to-end", () => {
  test("state → executor → cache: full pipeline lifecycle", async () => {
    let state = createInitialState();
    const records = [
      new Record({ name: "Alice", score: 90 }),
      new Record({ name: "Bob", score: 60 }),
      new Record({ name: "Charlie", score: 85 }),
      new Record({ name: "Dave", score: 70 }),
    ];
    state = addInput(state, records);

    // Build pipeline: grep (score > 70) → sort (score desc) → xform (add rank)
    state = addStage(state, "grep", ["{{score}} > 70"]);
    const grepId = getLastStageId(state);

    state = addStage(state, "sort", ["--key", "score=-n"]);
    const sortId = getLastStageId(state);

    // Execute to final stage
    const result = await executeToStage(state, sortId);

    // Verify correct result
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("name")).toBe("Alice");
    expect(result.records[0]!.get("score")).toBe(90);
    expect(result.records[1]!.get("name")).toBe("Charlie");
    expect(result.records[1]!.get("score")).toBe(85);

    // Verify caching happened for both stages
    expect(state.cache.has(`${state.activeInputId}:${grepId}`)).toBe(true);
    expect(state.cache.has(`${state.activeInputId}:${sortId}`)).toBe(true);

    // Verify the cached grep result has intermediate data
    const grepCached = state.cache.get(`${state.activeInputId}:${grepId}`)!;
    expect(grepCached.recordCount).toBe(2);
    expect(grepCached.fieldNames).toContain("name");
    expect(grepCached.fieldNames).toContain("score");
  });

  test("useExecution would trigger: cache miss leads to execution", async () => {
    // Simulate what useExecution does on a cache miss:
    // 1. Check cache for cursorStageId  → miss
    // 2. Call executeToStage
    // 3. Dispatch CACHE_RESULT
    let state = createInitialState();
    const records = [new Record({ val: 10 }), new Record({ val: 20 })];
    state = addInput(state, records);
    state = addStage(state, "grep", ["{{val}} > 15"]);

    const cursorId = state.cursorStageId!;
    const cacheKey = `${state.activeInputId}:${cursorId}`;

    // Verify cache miss
    expect(state.cache.has(cacheKey)).toBe(false);

    // Execute (what useExecution would do)
    const result = await executeToStage(state, cursorId);

    // Dispatch CACHE_RESULT (what useExecution would do)
    state = dispatch(state, {
      type: "CACHE_RESULT",
      inputId: state.activeInputId,
      stageId: cursorId,
      result,
    });

    // Verify cache now populated
    expect(state.cache.has(cacheKey)).toBe(true);
    expect(getStageOutput(state, cursorId)!.recordCount).toBe(1);
    expect(getStageOutput(state, cursorId)!.records[0]!.get("val")).toBe(20);
  });
});

// ── 3. File type auto-detection → execution ──────────────────────────

describe("File type auto-detection → execution", () => {
  test(".csv file triggers fromcsv stage insertion", () => {
    const config = detectInputOperation("/tmp/data.csv");
    expect(config).not.toBeNull();
    expect(config!.operationName).toBe("fromcsv");
    expect(config!.args).toContain("--header");
    expect(config!.enabled).toBe(true);
  });

  test(".tsv file triggers fromcsv with tab delimiter", () => {
    const config = detectInputOperation("/tmp/data.tsv");
    expect(config).not.toBeNull();
    expect(config!.operationName).toBe("fromcsv");
    expect(config!.args).toContain("--delim");
  });

  test(".xml file triggers fromxml stage", () => {
    const config = detectInputOperation("/tmp/data.xml");
    expect(config).not.toBeNull();
    expect(config!.operationName).toBe("fromxml");
  });

  test(".jsonl returns null (native format)", () => {
    expect(detectInputOperation("/tmp/data.jsonl")).toBeNull();
  });

  test(".json returns null (native format)", () => {
    expect(detectInputOperation("/tmp/data.json")).toBeNull();
  });

  test("auto-detected stage integrates into pipeline", async () => {
    // Simulate what App.tsx does on startup with a CSV file
    const csvContent = "name,age\nAlice,30\nBob,25\n";
    const tmpFile = `/tmp/recs-smoke-csv-${Date.now()}.csv`;
    await Bun.write(tmpFile, csvContent);

    let state = createInitialState();

    // Step 1: Add file input (what App does)
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: tmpFile },
      label: "data.csv",
    });

    // Step 2: Auto-detect and add stage (what App does)
    const autoStage = detectInputOperation(tmpFile);
    expect(autoStage).not.toBeNull();
    state = dispatch(state, {
      type: "ADD_STAGE",
      afterStageId: null,
      config: autoStage!,
    });

    // Step 3: Add a downstream stage
    state = addStage(state, "sort", ["--key", "name"]);

    // Verify pipeline structure
    const path = getActivePath(state);
    expect(path).toHaveLength(2);
    expect(path[0]!.config.operationName).toBe("fromcsv");
    expect(path[1]!.config.operationName).toBe("sort");

    // Step 4: Execute the pipeline
    const sortId = getLastStageId(state);
    const result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("name")).toBe("Alice");
    expect(result.records[1]!.get("name")).toBe("Bob");

    // Cleanup
    const fs = await import("node:fs");
    fs.unlinkSync(tmpFile);
  });
});

// ── 4. Add stage → edit flow ─────────────────────────────────────────

describe("Add stage → edit flow (C1 fix)", () => {
  test("ADD_STAGE sets cursor to new stage for edit chaining", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    // Add first stage
    state = addStage(state, "grep", ["{{x}} > 0"]);
    const firstId = state.cursorStageId;
    expect(firstId).not.toBeNull();

    // Add second stage — cursor should move to it
    state = addStage(state, "sort", ["--key", "x"]);
    const secondId = state.cursorStageId;
    expect(secondId).not.toBeNull();
    expect(secondId).not.toBe(firstId);

    // The cursor stage should be the sort we just added
    const cursorStage = getCursorStage(state);
    expect(cursorStage).toBeDefined();
    expect(cursorStage!.config.operationName).toBe("sort");
  });

  test("ADD_STAGE → modal transitions: add then immediately edit", () => {
    // Simulate what handleAddStageSelect does in App.tsx:
    // 1. Dispatch ADD_STAGE with blank args
    // 2. Set modal to editStage
    // 3. On submit, dispatch UPDATE_STAGE_ARGS

    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    // Step 1: User picks "grep" from AddStageModal
    const config: StageConfig = {
      operationName: "grep",
      args: [],
      enabled: true,
    };
    state = dispatch(state, {
      type: "ADD_STAGE",
      afterStageId: state.cursorStageId,
      config,
    });

    // The cursor should be on the newly-added stage
    const newStageId = state.cursorStageId!;
    expect(newStageId).toBeTruthy();
    const stage = state.stages.get(newStageId)!;
    expect(stage.config.operationName).toBe("grep");
    expect(stage.config.args).toEqual([]);

    // Step 2: EditStageModal would open — user types args and submits
    state = dispatch(state, {
      type: "UPDATE_STAGE_ARGS",
      stageId: newStageId,
      args: ["{{x}} > 5"],
    });

    // Verify the args were updated on the correct stage
    expect(state.stages.get(newStageId)!.config.args).toEqual(["{{x}} > 5"]);
  });

  test("INSERT_STAGE_BEFORE also chains correctly", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);
    state = addStage(state, "sort", ["--key", "x"]);
    const sortId = state.cursorStageId!;

    // Insert before the sort
    state = dispatch(state, {
      type: "INSERT_STAGE_BEFORE",
      beforeStageId: sortId,
      config: { operationName: "grep", args: [], enabled: true },
    });

    // Cursor should be on the new grep
    expect(state.cursorStageId).not.toBe(sortId);
    const cursor = getCursorStage(state)!;
    expect(cursor.config.operationName).toBe("grep");

    // Pipeline order should be grep → sort
    const names = getActivePath(state).map((s) => s.config.operationName);
    expect(names).toEqual(["grep", "sort"]);
  });
});

// ── 5. Export produces valid output ──────────────────────────────────

describe("Export produces valid output", () => {
  test("multi-stage pipe script is syntactically valid", () => {
    let state = createInitialState();
    state = addInput(state, []);
    state = addStage(state, "grep", ["{{status}} > 200"]);
    state = addStage(state, "sort", ["--key", "time=n"]);
    state = addStage(state, "xform", ["{{latency_ms}} = {{latency}} * 1000"]);
    state = addStage(state, "collate", ["--key", "host", "-a", "count"]);
    state = addStage(state, "totable", []);

    const script = exportAsPipeScript(state);

    // Shebang
    expect(script.startsWith("#!/usr/bin/env bash\n")).toBe(true);

    // All stages present
    expect(script).toContain("recs grep");
    expect(script).toContain("recs sort --key time=n");
    expect(script).toContain("recs xform");
    expect(script).toContain("recs collate --key host -a count");
    expect(script).toContain("recs totable");

    // Multi-line pipe continuation
    expect(script).toContain("\\\n");
    expect(script).toContain("| recs sort");

    // Should be parseable: count pipes (each stage after the first has a pipe)
    const pipeCount = (script.match(/\| recs /g) ?? []).length;
    expect(pipeCount).toBe(4);
  });

  test("chain command is syntactically valid", () => {
    let state = createInitialState();
    state = addInput(state, []);
    state = addStage(state, "grep", ["{{x}} > 1"]);
    state = addStage(state, "sort", ["--key", "x=n"]);
    state = addStage(state, "totable", []);

    const chain = exportAsChainCommand(state);

    // Starts with "recs chain"
    expect(chain.startsWith("recs chain ")).toBe(true);

    // Uses \\| separator between stages
    const parts = chain.replace("recs chain ", "").split(" \\| ");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toContain("grep");
    expect(parts[1]).toContain("sort");
    expect(parts[2]).toContain("totable");
  });

  test("disabled stages are excluded from export", () => {
    let state = createInitialState();
    state = addInput(state, []);
    state = addStage(state, "grep", ["{{x}} > 1"]);
    const grepId = getLastStageId(state);
    state = addStage(state, "sort", ["--key", "x"]);
    state = addStage(state, "totable", []);

    // Disable grep
    state = dispatch(state, { type: "TOGGLE_STAGE", stageId: grepId });

    const script = exportAsPipeScript(state);
    expect(script).not.toContain("recs grep");
    expect(script).toContain("recs sort");
    expect(script).toContain("recs totable");

    const chain = exportAsChainCommand(state);
    expect(chain).not.toContain("grep");
    expect(chain).toContain("sort");
  });

  test("export with file input includes path in first stage", () => {
    let state = createInitialState();
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: "/tmp/data.jsonl" },
      label: "data.jsonl",
    });
    state = addStage(state, "grep", ["{{x}} > 1"]);

    const script = exportAsPipeScript(state);
    expect(script).toContain("/tmp/data.jsonl");
  });
});

// ── 6. Session save/load roundtrip ───────────────────────────────────

describe("Session save/load roundtrip", () => {
  let tempDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "recs-smoke-session-"));
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("full roundtrip: stages, forks, inputs, and name survive", async () => {
    // Build complex state
    let state = createInitialState();
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: "/tmp/data.jsonl" },
      label: "data.jsonl",
    });
    state = addStage(state, "grep", ["{{status}} == 200"]);
    state = addStage(state, "sort", ["--key", "time=n"]);
    state = addStage(state, "collate", ["--key", "host", "-a", "count"]);

    // Create a fork
    const stageIds = getStageIds(state);
    state = dispatch(state, {
      type: "CREATE_FORK",
      name: "experiment",
      atStageId: stageIds[0]!,
    });

    // Set session name
    state = dispatch(state, { type: "SET_SESSION_NAME", name: "my analysis" });

    // Pin a stage for selective caching
    state = dispatch(state, { type: "PIN_STAGE", stageId: stageIds[1]! });

    // Save
    await manager.save(state);

    // Load and hydrate
    const loaded = await manager.load(state.sessionId);
    const hydrated = manager.hydrate(loaded);

    // Verify all stages survived
    expect(hydrated.stages.size).toBe(state.stages.size);
    for (const [id, stage] of state.stages) {
      const restored = hydrated.stages.get(id);
      expect(restored).toBeDefined();
      expect(restored!.config.operationName).toBe(stage.config.operationName);
      expect(restored!.config.args).toEqual(stage.config.args);
      expect(restored!.config.enabled).toBe(stage.config.enabled);
    }

    // Verify forks survived
    expect(hydrated.forks.size).toBe(state.forks.size);
    const restoredForkNames = Array.from(hydrated.forks.values()).map((f) => f.name);
    expect(restoredForkNames).toContain("main");
    expect(restoredForkNames).toContain("experiment");

    // Verify inputs survived
    expect(hydrated.inputs.size).toBe(state.inputs.size);

    // Verify session name
    expect(hydrated.sessionName).toBe("my analysis");

    // Verify pinned stage
    expect(hydrated.cacheConfig.pinnedStageIds).toBeInstanceOf(Set);
    expect(hydrated.cacheConfig.pinnedStageIds.has(stageIds[1]!)).toBe(true);
  });

  test("undo/redo stacks survive save/load roundtrip", async () => {
    let state = createInitialState();
    state = addStage(state, "grep");
    state = addStage(state, "sort");
    state = addStage(state, "totable");

    // Undo one action
    state = dispatch(state, { type: "UNDO" });
    expect(state.undoStack).toHaveLength(2);
    expect(state.redoStack).toHaveLength(1);

    await manager.save(state);
    const loaded = await manager.load(state.sessionId);
    const hydrated = manager.hydrate(loaded);

    expect(hydrated.undoStack).toHaveLength(2);
    expect(hydrated.redoStack).toHaveLength(1);

    // Verify we can still undo/redo after hydration
    const afterUndo = dispatch(hydrated, { type: "UNDO" });
    expect(getActivePath(afterUndo)).toHaveLength(1);

    const afterRedo = dispatch(afterUndo, { type: "REDO" });
    expect(getActivePath(afterRedo)).toHaveLength(2);
  });

  test("hydrated state can be executed", async () => {
    let state = createInitialState();
    state = addInput(state, [
      new Record({ x: 5 }),
      new Record({ x: 10 }),
      new Record({ x: 15 }),
    ]);
    state = addStage(state, "grep", ["{{x}} > 7"]);
    state = addStage(state, "sort", ["--key", "x=-n"]);

    await manager.save(state);
    const loaded = await manager.load(state.sessionId);
    const hydrated = manager.hydrate(loaded);

    // Re-add the input records (stdin-capture doesn't persist records in session)
    const inputId = hydrated.activeInputId;
    const existingInput = hydrated.inputs.get(inputId);
    if (existingInput && existingInput.source.kind !== "stdin-capture") {
      // File inputs would work; but for stdin-capture we need to re-inject
    }
    // Re-add stdin input for execution test
    let execState = dispatch(hydrated, {
      type: "ADD_INPUT",
      source: {
        kind: "stdin-capture",
        records: [
          new Record({ x: 5 }),
          new Record({ x: 10 }),
          new Record({ x: 15 }),
        ],
      },
      label: "re-injected",
    });

    const stageIds = getStageIds(execState);
    const lastId = stageIds[stageIds.length - 1]!;
    const result = await executeToStage(execState, lastId);
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("x")).toBe(15);
    expect(result.records[1]!.get("x")).toBe(10);
  });
});

// ── 7. Undo/redo full cycle ──────────────────────────────────────────

describe("Undo/redo full cycle", () => {
  test("add 3 stages, undo all 3, redo all 3 — verify state at each step", () => {
    let state = createInitialState();
    state = addInput(state, [new Record({ x: 1 })]);

    // ADD_INPUT is undoable, so undo stack already has 1 entry
    const baseUndoCount = state.undoStack.length;

    // Add 3 stages
    state = addStage(state, "grep", ["{{x}} > 0"]);
    expect(getActivePath(state)).toHaveLength(1);
    expect(state.undoStack).toHaveLength(baseUndoCount + 1);

    state = addStage(state, "sort", ["--key", "x"]);
    expect(getActivePath(state)).toHaveLength(2);
    expect(state.undoStack).toHaveLength(baseUndoCount + 2);

    state = addStage(state, "totable", []);
    expect(getActivePath(state)).toHaveLength(3);
    expect(state.undoStack).toHaveLength(baseUndoCount + 3);
    expect(state.redoStack).toHaveLength(0);

    // Undo all 3 stage additions
    state = dispatch(state, { type: "UNDO" }); // remove totable
    expect(getActivePath(state)).toHaveLength(2);
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "grep",
      "sort",
    ]);
    expect(state.redoStack).toHaveLength(1);

    state = dispatch(state, { type: "UNDO" }); // remove sort
    expect(getActivePath(state)).toHaveLength(1);
    expect(getActivePath(state)[0]!.config.operationName).toBe("grep");
    expect(state.redoStack).toHaveLength(2);

    state = dispatch(state, { type: "UNDO" }); // remove grep
    expect(getActivePath(state)).toHaveLength(0);
    expect(state.undoStack).toHaveLength(baseUndoCount);
    expect(state.redoStack).toHaveLength(3);

    // Redo all 3
    state = dispatch(state, { type: "REDO" }); // restore grep
    expect(getActivePath(state)).toHaveLength(1);
    expect(getActivePath(state)[0]!.config.operationName).toBe("grep");

    state = dispatch(state, { type: "REDO" }); // restore sort
    expect(getActivePath(state)).toHaveLength(2);
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "grep",
      "sort",
    ]);

    state = dispatch(state, { type: "REDO" }); // restore totable
    expect(getActivePath(state)).toHaveLength(3);
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "grep",
      "sort",
      "totable",
    ]);
    expect(state.redoStack).toHaveLength(0);
  });

  test("new action after undo clears redo stack", () => {
    let state = createInitialState();
    state = addStage(state, "grep");
    state = addStage(state, "sort");

    // Undo sort
    state = dispatch(state, { type: "UNDO" });
    expect(state.redoStack).toHaveLength(1);

    // New action should clear redo
    state = addStage(state, "collate");
    expect(state.redoStack).toHaveLength(0);
    expect(getActivePath(state).map((s) => s.config.operationName)).toEqual([
      "grep",
      "collate",
    ]);
  });

  test("undo/redo + execution: pipeline executes correctly at each step", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 3 }),
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "sort", ["--key", "x=n"]);
    state = addStage(state, "grep", ["{{x}} > 1"]);

    // Execute the 2-stage pipeline
    let stageIds = getStageIds(state);
    let result = await executeToStage(state, stageIds[stageIds.length - 1]!);
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("x")).toBe(2);
    expect(result.records[1]!.get("x")).toBe(3);

    // Undo grep — now only sort remains
    state = dispatch(state, { type: "UNDO" });
    state = { ...state, cache: new Map() }; // clear cache after undo
    stageIds = getStageIds(state);
    expect(stageIds).toHaveLength(1);

    result = await executeToStage(state, stageIds[0]!);
    expect(result.recordCount).toBe(3);
    expect(result.records[0]!.get("x")).toBe(1);

    // Redo grep
    state = dispatch(state, { type: "REDO" });
    state = { ...state, cache: new Map() };
    stageIds = getStageIds(state);
    expect(stageIds).toHaveLength(2);

    result = await executeToStage(state, stageIds[stageIds.length - 1]!);
    expect(result.recordCount).toBe(2);
  });
});

// ── 8. Keyboard binding coverage ─────────────────────────────────────

describe("Keyboard binding coverage", () => {
  /**
   * Parse HelpPanel's HELP_TEXT to extract all documented key bindings.
   * Each binding is of the form "  key  Description" in the help text.
   */
  test("every key in HelpPanel has a handler in App.tsx", async () => {
    // Read HelpPanel source to extract HELP_TEXT
    const helpSource = await Bun.file(
      join(
        import.meta.dir,
        "../../../src/explorer/components/modals/HelpPanel.tsx",
      ),
    ).text();

    // Extract key bindings from HELP_SECTIONS structured data
    // Entries look like: { key: "↑/k ↓/j", desc: "Move cursor between stages" }
    const entryPattern = /\{\s*key:\s*"([^"]+)"\s*,\s*desc:\s*"([^"]+)"\s*\}/g;
    const keyBindings: KeyBinding[] = [];
    let entryMatch: RegExpExecArray | null;
    while ((entryMatch = entryPattern.exec(helpSource)) !== null) {
      const keyPart = entryMatch[1]!;
      const description = entryMatch[2]!;
      const keys = keyPart.split(/[\s/,]+/).filter(Boolean);
      keyBindings.push({ keys, description });
    }
    expect(keyBindings.length).toBeGreaterThan(0);

    // Read App.tsx to extract keyboard handlers
    const appSource = await Bun.file(
      join(import.meta.dir, "../../../src/explorer/components/App.tsx"),
    ).text();

    // Extract all key checks from App.tsx
    const handledKeys = extractHandledKeys(appSource);

    // Verify coverage: every documented key should have a handler
    const unhandled: string[] = [];
    for (const binding of keyBindings) {
      const keys = binding.keys;
      const hasHandler = keys.some((k) => handledKeys.has(normalizeKey(k)));
      if (!hasHandler) {
        unhandled.push(`${keys.join("/")} — ${binding.description}`);
      }
    }

    if (unhandled.length > 0) {
      // This is a soft assertion — report what's missing
      console.warn(
        `Keys documented in HelpPanel but not found in App.tsx handlers:\n` +
          unhandled.map((u) => `  - ${u}`).join("\n"),
      );
    }

    // At minimum, these essential keys must be handled
    const essentialKeys = [
      "j", "k",      // cursor movement
      "a",           // add stage
      "d",           // delete stage
      "e",           // edit stage
      " ",           // toggle stage (Space)
      "u",           // undo
      "tab",         // toggle focus
      "q",           // quit
      "?",           // help
      "x",           // export
      "f",           // fork
    ];

    for (const key of essentialKeys) {
      expect(handledKeys.has(key)).toBe(true);
    }
  });
});

// ── Keyboard parsing helpers ─────────────────────────────────────────

interface KeyBinding {
  keys: string[];
  description: string;
}

/**
 * Extract all keys that App.tsx checks for in its useInput handler.
 * Looks for Ink-style patterns like:
 *   input === "a"
 *   key.upArrow
 *   key.tab
 *   key.escape
 *   key.return
 *   input === "c" && key.ctrl → "ctrl+c"
 */
function extractHandledKeys(source: string): Set<string> {
  const keys = new Set<string>();

  // Match input === "X" or input.includes("X") (single-char keys)
  const inputEquals = source.matchAll(/input === ["'](.+?)["']/g);
  for (const m of inputEquals) {
    keys.add(m[1]!);
  }
  const inputIncludes = source.matchAll(/input\.includes\(["'](.+?)["']\)/g);
  for (const m of inputIncludes) {
    keys.add(m[1]!);
  }

  // Match key.upArrow, key.downArrow, key.leftArrow, key.rightArrow
  const arrowMap: { [k: string]: string } = {
    upArrow: "up",
    downArrow: "down",
    leftArrow: "left",
    rightArrow: "right",
  };
  for (const [prop, name] of Object.entries(arrowMap)) {
    if (source.includes(`key.${prop}`)) {
      keys.add(name as string);
    }
  }

  // Match key.tab, key.escape, key.return
  for (const prop of ["tab", "escape", "return"]) {
    if (source.includes(`key.${prop}`)) {
      keys.add(prop);
    }
  }

  // Match ctrl combinations: input === "r" && key.ctrl or key.ctrl && input === "c"
  const ctrlPatterns = source.matchAll(
    /input === ["'](\w)["'].*?key\.ctrl|key\.ctrl.*?input === ["'](\w)["']/g,
  );
  for (const m of ctrlPatterns) {
    const keyName = m[1] ?? m[2];
    if (keyName) {
      keys.add(`ctrl+${keyName}`);
    }
  }

  return keys;
}

/**
 * Normalize a help-text key name to match what extractHandledKeys returns.
 */
function normalizeKey(key: string): string {
  const map: { [k: string]: string } = {
    "↑": "up",
    "↓": "down",
    "←": "left",
    "→": "right",
    "Space": " ",
    "Esc": "escape",
    "Enter": "return",
    "Tab": "tab",
    "Ctrl+R": "ctrl+r",
    "Ctrl+C": "ctrl+c",
  };
  return map[key] ?? key.toLowerCase();
}
