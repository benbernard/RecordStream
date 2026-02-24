import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { SessionManager } from "../../../src/explorer/session/session-manager.ts";
import { SessionCacheStore } from "../../../src/explorer/session/session-cache-store.ts";
import {
  createInitialState,
  pipelineReducer,
} from "../../../src/explorer/model/reducer.ts";
import type {
  PipelineState,
  StageConfig,
  CachedResult,
} from "../../../src/explorer/model/types.ts";
import { Record } from "../../../src/Record.ts";

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

function addInput(
  state: PipelineState,
  path: string,
  label: string,
): PipelineState {
  return pipelineReducer(state, {
    type: "ADD_INPUT",
    source: { kind: "file", path },
    label,
  });
}

describe("SessionManager", () => {
  let tempDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "recs-explorer-test-"));
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ── Save and Load ─────────────────────────────────────────────

  describe("save and load", () => {
    test("saves and loads a session with pipeline state", async () => {
      let state = createInitialState();
      state = addInput(state, "/tmp/test.jsonl", "test.jsonl");
      state = addStage(state, "grep", ["status=200"]);
      state = addStage(state, "sort", ["--key", "time=n"]);

      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      expect(loaded.version).toBe(1);
      expect(loaded.sessionId).toBe(state.sessionId);
    });

    test("hydrate restores Maps from serialized data", async () => {
      let state = createInitialState();
      state = addInput(state, "/tmp/test.jsonl", "test.jsonl");
      state = addStage(state, "grep", ["status=200"]);
      state = addStage(state, "sort");

      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      const hydrated = manager.hydrate(loaded);

      expect(hydrated.stages).toBeInstanceOf(Map);
      expect(hydrated.forks).toBeInstanceOf(Map);
      expect(hydrated.inputs).toBeInstanceOf(Map);
      expect(hydrated.stages.size).toBe(state.stages.size);
      expect(hydrated.forks.size).toBe(state.forks.size);
    });

    test("hydrate preserves stage configs", async () => {
      let state = createInitialState();
      state = addStage(state, "grep", ["status=200"]);

      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      const hydrated = manager.hydrate(loaded);

      const stages = Array.from(hydrated.stages.values());
      expect(stages).toHaveLength(1);
      expect(stages[0]!.config.operationName).toBe("grep");
      expect(stages[0]!.config.args).toEqual(["status=200"]);
    });

    test("hydrate preserves undo/redo stacks", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      state = addStage(state, "sort");
      // Undo one action to populate redo stack
      state = pipelineReducer(state, { type: "UNDO" });

      expect(state.undoStack).toHaveLength(1);
      expect(state.redoStack).toHaveLength(1);

      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      const hydrated = manager.hydrate(loaded);

      expect(hydrated.undoStack).toHaveLength(1);
      expect(hydrated.redoStack).toHaveLength(1);
      // Undo entries contain Maps in their snapshots
      expect(hydrated.undoStack[0]!.snapshot.stages).toBeInstanceOf(Map);
    });

    test("hydrate restores cacheConfig with Set", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      const stageId = state.cursorStageId!;

      // Pin a stage
      state = pipelineReducer(state, {
        type: "PIN_STAGE",
        stageId,
      });
      state = pipelineReducer(state, {
        type: "SET_CACHE_POLICY",
        policy: "selective",
      });

      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      const hydrated = manager.hydrate(loaded);

      expect(hydrated.cacheConfig.pinnedStageIds).toBeInstanceOf(Set);
      expect(hydrated.cacheConfig.pinnedStageIds.has(stageId)).toBe(true);
      expect(hydrated.cacheConfig.cachePolicy).toBe("selective");
    });

    test("hydrate initializes transient state", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");

      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      const hydrated = manager.hydrate(loaded);

      // Transient state should be initialized to defaults
      expect(hydrated.focusedPanel).toBe("pipeline");
      expect(hydrated.cache).toBeInstanceOf(Map);
      expect(hydrated.cache.size).toBe(0);
      expect(hydrated.executing).toBe(false);
      expect(hydrated.lastError).toBeNull();
      expect(hydrated.inspector.viewMode).toBe("table");
    });

    test("load updates lastAccessedAt", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");

      await manager.save(state);

      const before = Date.now();
      const loaded = await manager.load(state.sessionId);
      expect(loaded.lastAccessedAt).toBeGreaterThanOrEqual(before);
    });
  });

  // ── List ──────────────────────────────────────────────────────

  describe("list", () => {
    test("lists all saved sessions", async () => {
      let state1 = createInitialState();
      state1 = addInput(state1, "/tmp/a.jsonl", "a.jsonl");
      state1 = addStage(state1, "grep");

      let state2 = createInitialState();
      state2 = addInput(state2, "/tmp/b.jsonl", "b.jsonl");
      state2 = addStage(state2, "sort");

      await manager.save(state1);
      await manager.save(state2);

      const sessions = await manager.list();
      expect(sessions).toHaveLength(2);
    });

    test("returns empty array when no sessions exist", async () => {
      const sessions = await manager.list();
      expect(sessions).toHaveLength(0);
    });

    test("sessions are sorted by lastAccessedAt descending", async () => {
      let state1 = createInitialState();
      state1 = addStage(state1, "grep");
      await manager.save(state1);

      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 50));

      let state2 = createInitialState();
      state2 = addStage(state2, "sort");
      await manager.save(state2);

      const sessions = await manager.list();
      expect(sessions[0]!.lastAccessedAt).toBeGreaterThanOrEqual(
        sessions[1]!.lastAccessedAt,
      );
    });

    test("metadata includes pipeline summary", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      state = addStage(state, "sort");
      state = addStage(state, "totable");
      await manager.save(state);

      const sessions = await manager.list();
      expect(sessions[0]!.pipelineSummary).toContain("grep");
      expect(sessions[0]!.stageCount).toBe(3);
    });
  });

  // ── Find by input path ────────────────────────────────────────

  describe("findByInputPath", () => {
    test("finds session by exact input path", async () => {
      let state = createInitialState();
      state = addInput(state, "/tmp/access.log", "access.log");
      state = addStage(state, "grep");
      await manager.save(state);

      const found = await manager.findByInputPath("/tmp/access.log");
      expect(found).not.toBeNull();
      expect(found!.sessionId).toBe(state.sessionId);
    });

    test("finds session by basename match", async () => {
      let state = createInitialState();
      state = addInput(state, "/tmp/access.log", "access.log");
      state = addStage(state, "grep");
      await manager.save(state);

      const found = await manager.findByInputPath("/other/path/access.log");
      expect(found).not.toBeNull();
      expect(found!.sessionId).toBe(state.sessionId);
    });

    test("returns null when no matching session", async () => {
      const found = await manager.findByInputPath("/nonexistent.jsonl");
      expect(found).toBeNull();
    });
  });

  // ── Clean ─────────────────────────────────────────────────────

  describe("clean", () => {
    test("removes sessions older than maxAgeMs", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      await manager.save(state);

      // Override meta.json with old timestamp
      const metaPath = join(tempDir, state.sessionId, "meta.json");
      const meta = JSON.parse(await Bun.file(metaPath).text()) as { [key: string]: unknown };
      meta["lastAccessedAt"] = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      await Bun.write(metaPath, JSON.stringify(meta));

      const removed = await manager.clean();
      expect(removed).toBe(1);

      const sessions = await manager.list();
      expect(sessions).toHaveLength(0);
    });

    test("keeps recent sessions", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      await manager.save(state);

      const removed = await manager.clean();
      expect(removed).toBe(0);

      const sessions = await manager.list();
      expect(sessions).toHaveLength(1);
    });

    test("custom maxAgeMs parameter", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      await manager.save(state);

      // Override to 1ms ago
      const metaPath = join(tempDir, state.sessionId, "meta.json");
      const meta = JSON.parse(await Bun.file(metaPath).text()) as { [key: string]: unknown };
      meta["lastAccessedAt"] = Date.now() - 5000; // 5 seconds ago
      await Bun.write(metaPath, JSON.stringify(meta));

      const removed = await manager.clean(1000); // 1 second max age
      expect(removed).toBe(1);
    });

    test("returns 0 when no sessions exist", async () => {
      const removed = await manager.clean();
      expect(removed).toBe(0);
    });
  });

  // ── Delete ────────────────────────────────────────────────────

  describe("delete", () => {
    test("removes a specific session", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      await manager.save(state);

      const sessionsBefore = await manager.list();
      expect(sessionsBefore).toHaveLength(1);

      await manager.delete(state.sessionId);

      const sessionsAfter = await manager.list();
      expect(sessionsAfter).toHaveLength(0);
    });

    test("does not throw for nonexistent session", async () => {
      await expect(manager.delete("nonexistent")).resolves.toBeUndefined();
    });
  });

  // ── Verify input files ────────────────────────────────────────

  describe("verifyInputFiles", () => {
    test("returns empty array when input files exist", async () => {
      // Use a file we know exists
      const existingFile = import.meta.path;
      let state = createInitialState();
      state = addInput(state, existingFile, "self");
      state = addStage(state, "grep");
      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      const missing = await manager.verifyInputFiles(loaded);
      expect(missing).toHaveLength(0);
    });

    test("returns missing file paths", async () => {
      let state = createInitialState();
      state = addInput(state, "/nonexistent/file.jsonl", "missing");
      state = addStage(state, "grep");
      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      const missing = await manager.verifyInputFiles(loaded);
      expect(missing).toContain("/nonexistent/file.jsonl");
    });
  });

  // ── Named sessions ───────────────────────────────────────────

  describe("named sessions", () => {
    test("save persists sessionName to session.json and meta.json", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      state = { ...state, sessionName: "my filter" };
      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      expect(loaded.name).toBe("my filter");

      const metaPath = join(tempDir, state.sessionId, "meta.json");
      const meta = JSON.parse(
        await Bun.file(metaPath).text(),
      ) as { name?: string };
      expect(meta.name).toBe("my filter");
    });

    test("hydrate restores sessionName from SessionFile", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      state = { ...state, sessionName: "experiment 1" };
      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      const hydrated = manager.hydrate(loaded);
      expect(hydrated.sessionName).toBe("experiment 1");
    });

    test("hydrate handles missing name gracefully", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      await manager.save(state);

      const loaded = await manager.load(state.sessionId);
      const hydrated = manager.hydrate(loaded);
      expect(hydrated.sessionName).toBeUndefined();
    });

    test("list returns name in metadata", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      state = { ...state, sessionName: "named session" };
      await manager.save(state);

      const sessions = await manager.list();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.name).toBe("named session");
    });

    test("saveAs creates new session with name", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      const newId = await manager.saveAs(state, "forked session");

      expect(newId).not.toBe(state.sessionId);

      const loaded = await manager.load(newId);
      expect(loaded.name).toBe("forked session");
      expect(loaded.sessionId).toBe(newId);
    });

    test("rename updates name on disk", async () => {
      let state = createInitialState();
      state = addStage(state, "grep");
      state = { ...state, sessionName: "old name" };
      await manager.save(state);

      await manager.rename(state.sessionId, "new name");

      const loaded = await manager.load(state.sessionId);
      expect(loaded.name).toBe("new name");

      const metaPath = join(tempDir, state.sessionId, "meta.json");
      const meta = JSON.parse(
        await Bun.file(metaPath).text(),
      ) as { name?: string };
      expect(meta.name).toBe("new name");
    });

    test("rename is safe for nonexistent session", async () => {
      await expect(
        manager.rename("nonexistent-id", "some name"),
      ).resolves.toBeUndefined();
    });
  });
});

// ── SessionCacheStore tests ──────────────────────────────────────

describe("SessionCacheStore", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "recs-cache-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeCachedResult(inputId: string, stageId: string): CachedResult {
    return {
      key: `${inputId}:${stageId}`,
      stageId,
      inputId,
      records: [
        new Record({ name: "alice", age: 30 }),
        new Record({ name: "bob", age: 25 }),
      ],
      lines: [],
      spillFile: null,
      recordCount: 2,
      fieldNames: ["name", "age"],
      computedAt: Date.now(),
      sizeBytes: 100,
      computeTimeMs: 5,
    };
  }

  test("writes and reads cache records", async () => {
    const store = new SessionCacheStore(tempDir);
    const result = makeCachedResult("input1", "stage1");

    const manifest = await store.writeCache(result);
    expect(manifest.key).toBe("input1:stage1");
    expect(manifest.recordCount).toBe(2);
    expect(manifest.file).toBe("cache/input1-stage1.jsonl");

    const loaded = await store.readCache(manifest, tempDir);
    expect(loaded.records).toHaveLength(2);
    expect(loaded.records[0]!.get("name")).toBe("alice");
    expect(loaded.records[1]!.get("age")).toBe(25);
    expect(loaded.stageId).toBe("stage1");
    expect(loaded.inputId).toBe("input1");
  });

  test("writeAllCaches writes multiple cache files", async () => {
    const store = new SessionCacheStore(tempDir);
    const cache = new Map<string, CachedResult>();
    cache.set("input1:stage1", makeCachedResult("input1", "stage1"));
    cache.set("input1:stage2", makeCachedResult("input1", "stage2"));

    const manifests = await store.writeAllCaches(cache);
    expect(manifests).toHaveLength(2);
  });

  test("removeCache removes a specific cache file", async () => {
    const store = new SessionCacheStore(tempDir);
    const result = makeCachedResult("input1", "stage1");
    await store.writeCache(result);

    await store.removeCache("input1", "stage1");

    // File should no longer exist
    const filePath = join(tempDir, "cache", "input1-stage1.jsonl");
    expect(await Bun.file(filePath).exists()).toBe(false);
  });

  test("clearAll removes the entire cache directory", async () => {
    const store = new SessionCacheStore(tempDir);
    await store.writeCache(makeCachedResult("input1", "stage1"));
    await store.writeCache(makeCachedResult("input1", "stage2"));

    await store.clearAll();

    const cacheDir = join(tempDir, "cache");
    const { stat } = await import("node:fs/promises");
    await expect(stat(cacheDir)).rejects.toThrow();
  });

  test("removeCache is no-op for nonexistent file", async () => {
    const store = new SessionCacheStore(tempDir);
    await expect(
      store.removeCache("nonexistent", "nonexistent"),
    ).resolves.toBeUndefined();
  });
});
