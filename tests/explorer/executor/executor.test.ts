import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { InterceptReceiver } from "../../../src/explorer/executor/intercept-receiver.ts";
import {
  executeToStage,
  getStagePath,
} from "../../../src/explorer/executor/executor.ts";
import { loadInputRecords } from "../../../src/explorer/executor/input-loader.ts";
import { createOperation } from "../../../src/operations/transform/chain.ts";
import type {
  PipelineState,
  Stage,
  InputSource,
  CacheConfig,
  InspectorState,
} from "../../../src/explorer/model/types.ts";

// ── Helpers ──────────────────────────────────────────────────────────

function makeStage(
  id: string,
  opName: string,
  args: string[],
  parentId: string | null,
  position: number,
): Stage {
  return {
    id,
    config: { operationName: opName, args, enabled: true },
    parentId,
    childIds: [],
    forkId: "main",
    position,
  };
}

function makePipelineState(
  stages: Stage[],
  input: InputSource,
): PipelineState {
  const stageMap = new Map<string, Stage>();
  for (const s of stages) {
    stageMap.set(s.id, s);
  }

  // Wire up childIds
  for (const s of stages) {
    if (s.parentId) {
      const parent = stageMap.get(s.parentId);
      if (parent && !parent.childIds.includes(s.id)) {
        parent.childIds.push(s.id);
      }
    }
  }

  const cacheConfig: CacheConfig = {
    maxMemoryBytes: 100 * 1024 * 1024,
    cachePolicy: "all",
    pinnedStageIds: new Set(),
  };

  const inspector: InspectorState = {
    viewMode: "table",
    scrollOffset: 0,
    searchQuery: null,
    highlightedColumn: null,
  };

  return {
    stages: stageMap,
    forks: new Map([
      [
        "main",
        {
          id: "main",
          name: "main",
          forkPointStageId: null,
          parentForkId: null,
          stageIds: stages.map((s) => s.id),
          createdAt: Date.now(),
        },
      ],
    ]),
    inputs: new Map([[input.id, input]]),
    activeInputId: input.id,
    activeForkId: "main",
    cursorStageId: stages[stages.length - 1]?.id ?? null,
    focusedPanel: "pipeline",
    cache: new Map(),
    cacheConfig,
    inspector,
    executing: false,
    lastError: null,
    undoStack: [],
    redoStack: [],
    sessionId: "test-session",
    sessionDir: "/tmp/recs-explorer-test",
  };
}

// ── InterceptReceiver tests ──────────────────────────────────────────

describe("InterceptReceiver", () => {
  test("collects records and tracks field names", () => {
    const receiver = new InterceptReceiver();
    const r1 = new Record({ name: "Alice", age: 30 });
    const r2 = new Record({ name: "Bob", city: "NYC" });

    receiver.acceptRecord(r1);
    receiver.acceptRecord(r2);
    receiver.finish();

    expect(receiver.recordCount).toBe(2);
    expect(receiver.records.length).toBe(2);
    expect(receiver.fieldNames).toEqual(new Set(["name", "age", "city"]));
  });

  test("clones records so originals are not mutated", () => {
    const receiver = new InterceptReceiver();
    const original = new Record({ x: 1 });

    receiver.acceptRecord(original);
    original.set("x", 999);

    expect(receiver.records[0]!.get("x")).toBe(1);
  });

  test("acceptLine collects lines", () => {
    const receiver = new InterceptReceiver();
    receiver.acceptLine("hello");
    receiver.acceptLine("world");

    expect(receiver.lines).toEqual(["hello", "world"]);
  });
});

// ── getStagePath tests ───────────────────────────────────────────────

describe("getStagePath", () => {
  test("returns ordered path from root to target", () => {
    const stages = [
      makeStage("s1", "grep", ["{{x}} > 1"], null, 0),
      makeStage("s2", "sort", ["--key", "x=n"], "s1", 1),
      makeStage("s3", "eval", ["{{y}} = {{x}} * 2"], "s2", 2),
    ];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: [] },
      label: "test",
    };
    const state = makePipelineState(stages, input);
    const path = getStagePath(state, "s3");

    expect(path.length).toBe(3);
    expect(path[0]!.id).toBe("s1");
    expect(path[1]!.id).toBe("s2");
    expect(path[2]!.id).toBe("s3");
  });

  test("returns single stage for root stage", () => {
    const stages = [makeStage("s1", "grep", ["{{x}} > 1"], null, 0)];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: [] },
      label: "test",
    };
    const state = makePipelineState(stages, input);
    const path = getStagePath(state, "s1");

    expect(path.length).toBe(1);
    expect(path[0]!.id).toBe("s1");
  });

  test("returns empty array for unknown stage", () => {
    const stages = [makeStage("s1", "grep", ["{{x}} > 1"], null, 0)];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: [] },
      label: "test",
    };
    const state = makePipelineState(stages, input);
    const path = getStagePath(state, "nonexistent");

    expect(path.length).toBe(0);
  });
});

// ── input-loader tests ───────────────────────────────────────────────

describe("loadInputRecords", () => {
  test("loads stdin-capture records directly", async () => {
    const records = [
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records },
      label: "test",
    };

    const loaded = await loadInputRecords(input);
    expect(loaded.length).toBe(2);
    expect(loaded[0]!.get("x")).toBe(1);
    expect(loaded[1]!.get("x")).toBe(2);
  });
});

// ── executeToStage integration tests ─────────────────────────────────

describe("executeToStage", () => {
  test("executes a single grep stage", async () => {
    const inputRecords = [
      new Record({ x: 1 }),
      new Record({ x: 3 }),
      new Record({ x: 5 }),
      new Record({ x: 2 }),
    ];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: inputRecords },
      label: "test",
    };
    const stages = [makeStage("s1", "grep", ["{{x}} > 2"], null, 0)];
    const state = makePipelineState(stages, input);

    const result = await executeToStage(state, "s1");

    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("x")).toBe(3);
    expect(result.records[1]!.get("x")).toBe(5);
    expect(result.fieldNames).toContain("x");
  });

  test("executes a pipeline: grep → sort", async () => {
    const inputRecords = [
      new Record({ x: 5, name: "eve" }),
      new Record({ x: 1, name: "alice" }),
      new Record({ x: 3, name: "charlie" }),
      new Record({ x: 2, name: "bob" }),
      new Record({ x: 4, name: "dave" }),
    ];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: inputRecords },
      label: "test",
    };
    const stages = [
      makeStage("s1", "grep", ["{{x}} > 2"], null, 0),
      makeStage("s2", "sort", ["--key", "x=n"], "s1", 1),
    ];
    const state = makePipelineState(stages, input);

    const result = await executeToStage(state, "s2");

    expect(result.recordCount).toBe(3);
    expect(result.records[0]!.get("x")).toBe(3);
    expect(result.records[1]!.get("x")).toBe(4);
    expect(result.records[2]!.get("x")).toBe(5);
    expect(result.fieldNames).toContain("x");
    expect(result.fieldNames).toContain("name");
  });

  test("uses cached results when available", async () => {
    const inputRecords = [
      new Record({ x: 5 }),
      new Record({ x: 1 }),
      new Record({ x: 3 }),
    ];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: inputRecords },
      label: "test",
    };
    const stages = [
      makeStage("s1", "grep", ["{{x}} > 2"], null, 0),
      makeStage("s2", "sort", ["--key", "x=n"], "s1", 1),
    ];
    const state = makePipelineState(stages, input);

    // Pre-populate cache for s1
    state.cache.set("in1:s1", {
      key: "in1:s1",
      stageId: "s1",
      inputId: "in1",
      records: [new Record({ x: 5 }), new Record({ x: 3 })],
      lines: [],
      spillFile: null,
      recordCount: 2,
      fieldNames: ["x"],
      computedAt: Date.now(),
      sizeBytes: 100,
      computeTimeMs: 10,
    });

    const result = await executeToStage(state, "s2");

    // Sort should only see the cached records (5, 3) → sorted: (3, 5)
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("x")).toBe(3);
    expect(result.records[1]!.get("x")).toBe(5);
  });

  test("handles disabled stages (pass-through)", async () => {
    const inputRecords = [
      new Record({ x: 3 }),
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: inputRecords },
      label: "test",
    };

    const disabledStage = makeStage("s1", "grep", ["{{x}} > 100"], null, 0);
    disabledStage.config.enabled = false;

    const stages = [
      disabledStage,
      makeStage("s2", "sort", ["--key", "x=n"], "s1", 1),
    ];
    const state = makePipelineState(stages, input);

    const result = await executeToStage(state, "s2");

    // Disabled grep should be skipped, so sort gets all 3 records
    expect(result.recordCount).toBe(3);
    expect(result.records[0]!.get("x")).toBe(1);
    expect(result.records[1]!.get("x")).toBe(2);
    expect(result.records[2]!.get("x")).toBe(3);
  });

  test("handles input op: fromcsv with parseContent", async () => {
    const csvContent = "name,age\nAlice,30\nBob,25\nCharlie,35\n";
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: [] },
      label: "test.csv",
    };
    // Override loadInputContent to return CSV
    const stages = [
      makeStage("s1", "fromcsv", ["--header"], null, 0),
    ];
    const state = makePipelineState(stages, input);

    // For stdin-capture with no records, loadInputContent returns "\n"
    // Instead, let's use a file-based approach with a temp file
    const tmpFile = `/tmp/recs-explorer-test-${Date.now()}.csv`;
    await Bun.write(tmpFile, csvContent);

    const fileInput: InputSource = {
      id: "in1",
      source: { kind: "file", path: tmpFile },
      label: "test.csv",
    };
    state.inputs.set("in1", fileInput);

    const result = await executeToStage(state, "s1");

    expect(result.recordCount).toBe(3);
    expect(result.records[0]!.get("name")).toBe("Alice");
    expect(result.records[0]!.get("age")).toBe("30");
    expect(result.records[1]!.get("name")).toBe("Bob");
    expect(result.records[2]!.get("name")).toBe("Charlie");

    // Clean up
    const fs = await import("node:fs");
    fs.unlinkSync(tmpFile);
  });

  test("handles error: bad grep expression", async () => {
    const inputRecords = [new Record({ x: 1 })];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: inputRecords },
      label: "test",
    };
    const stages = [
      makeStage("s1", "grep", ["this is not valid {{{{"], null, 0),
    ];
    const state = makePipelineState(stages, input);

    await expect(executeToStage(state, "s1")).rejects.toThrow();
  });

  test("caches intermediate results during multi-stage execution", async () => {
    const inputRecords = [
      new Record({ x: 5, y: "b" }),
      new Record({ x: 1, y: "a" }),
      new Record({ x: 3, y: "c" }),
    ];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: inputRecords },
      label: "test",
    };
    const stages = [
      makeStage("s1", "sort", ["--key", "x=n"], null, 0),
      makeStage("s2", "grep", ["{{x}} > 1"], "s1", 1),
    ];
    const state = makePipelineState(stages, input);

    await executeToStage(state, "s2");

    // Both stages should be cached
    expect(state.cache.has("in1:s1")).toBe(true);
    expect(state.cache.has("in1:s2")).toBe(true);

    const s1Cache = state.cache.get("in1:s1")!;
    expect(s1Cache.recordCount).toBe(3);
    expect(s1Cache.records[0]!.get("x")).toBe(1);

    const s2Cache = state.cache.get("in1:s2")!;
    expect(s2Cache.recordCount).toBe(2);
  });

  test("executes xform stage with field transformation", async () => {
    const inputRecords = [
      new Record({ x: 10 }),
      new Record({ x: 20 }),
    ];
    const input: InputSource = {
      id: "in1",
      source: { kind: "stdin-capture", records: inputRecords },
      label: "test",
    };
    const stages = [
      makeStage("s1", "xform", ["{{doubled}} = {{x}} * 2"], null, 0),
    ];
    const state = makePipelineState(stages, input);

    const result = await executeToStage(state, "s1");

    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("doubled")).toBe(20);
    expect(result.records[1]!.get("doubled")).toBe(40);
    expect(result.fieldNames).toContain("x");
    expect(result.fieldNames).toContain("doubled");
  });
});

// ── Self-contained op tests (fromps without input source) ─────────────────

// fromps spawns `ps aux` which is slow and may fail in sandboxed environments.
// Run explicitly with: RUN_SLOW=1 bun test tests/explorer/executor/executor.test.ts
const describeFromps = process.env["RUN_SLOW"] ? describe : describe.skip;

describeFromps("Self-contained ops (no input source)", () => {
  test(
    "fromps executes and produces records without an input source",
    async () => {
      const stages = [makeStage("s1", "fromps", [], null, 0)];
      const stageMap = new Map<string, Stage>();
      for (const s of stages) stageMap.set(s.id, s);

      const cacheConfig: CacheConfig = {
        maxMemoryBytes: 100 * 1024 * 1024,
        cachePolicy: "all",
        pinnedStageIds: new Set(),
      };
      const inspector: InspectorState = {
        viewMode: "table",
        scrollOffset: 0,
        searchQuery: null,
        highlightedColumn: null,
      };

      const state: PipelineState = {
        stages: stageMap,
        forks: new Map([
          [
            "main",
            {
              id: "main",
              name: "main",
              forkPointStageId: null,
              parentForkId: null,
              stageIds: ["s1"],
              createdAt: Date.now(),
            },
          ],
        ]),
        inputs: new Map(),
        activeInputId: "no-input",
        activeForkId: "main",
        cursorStageId: "s1",
        focusedPanel: "pipeline",
        cache: new Map(),
        cacheConfig,
        inspector,
        executing: false,
        lastError: null,
        undoStack: [],
        redoStack: [],
        sessionId: "test-session",
        sessionDir: "/tmp/recs-explorer-test",
      };

      const result = await executeToStage(state, "s1");

      expect(result.recordCount).toBeGreaterThan(0);
      expect(result.records.length).toBeGreaterThan(0);
      expect(result.fieldNames.length).toBeGreaterThan(0);
    },
    30000,
  );

  test(
    "fromps + grep pipeline works without input source",
    async () => {
      const stages = [
        makeStage("s1", "fromps", [], null, 0),
        makeStage("s2", "grep", ["true"], "s1", 1),
      ];
      const stageMap = new Map<string, Stage>();
      for (const s of stages) stageMap.set(s.id, s);
      stageMap.get("s1")!.childIds = ["s2"];

      const cacheConfig: CacheConfig = {
        maxMemoryBytes: 100 * 1024 * 1024,
        cachePolicy: "all",
        pinnedStageIds: new Set(),
      };
      const inspector: InspectorState = {
        viewMode: "table",
        scrollOffset: 0,
        searchQuery: null,
        highlightedColumn: null,
      };

      const state: PipelineState = {
        stages: stageMap,
        forks: new Map([
          [
            "main",
            {
              id: "main",
              name: "main",
              forkPointStageId: null,
              parentForkId: null,
              stageIds: ["s1", "s2"],
              createdAt: Date.now(),
            },
          ],
        ]),
        inputs: new Map(),
        activeInputId: "no-input",
        activeForkId: "main",
        cursorStageId: "s2",
        focusedPanel: "pipeline",
        cache: new Map(),
        cacheConfig,
        inspector,
        executing: false,
        lastError: null,
        undoStack: [],
        redoStack: [],
        sessionId: "test-session",
        sessionDir: "/tmp/recs-explorer-test",
      };

      const result = await executeToStage(state, "s2");

      expect(result.recordCount).toBeGreaterThan(0);
      expect(result.records.length).toBeGreaterThan(0);
    },
    30000,
  );
});

// ── Direct operation tests (using InterceptReceiver with createOperation) ─

describe("createOperation + InterceptReceiver", () => {
  test("grep filters records through InterceptReceiver", () => {
    const receiver = new InterceptReceiver();
    const op = createOperation("grep", ["{{x}} > 2"], receiver);

    op.acceptRecord(new Record({ x: 1 }));
    op.acceptRecord(new Record({ x: 3 }));
    op.acceptRecord(new Record({ x: 5 }));
    op.finish();

    expect(receiver.recordCount).toBe(2);
    expect(receiver.records[0]!.get("x")).toBe(3);
    expect(receiver.records[1]!.get("x")).toBe(5);
  });

  test("sort reorders records through InterceptReceiver", () => {
    const receiver = new InterceptReceiver();
    const op = createOperation("sort", ["--key", "x=n"], receiver);

    op.acceptRecord(new Record({ x: 3 }));
    op.acceptRecord(new Record({ x: 1 }));
    op.acceptRecord(new Record({ x: 2 }));
    op.finish();

    expect(receiver.recordCount).toBe(3);
    expect(receiver.records[0]!.get("x")).toBe(1);
    expect(receiver.records[1]!.get("x")).toBe(2);
    expect(receiver.records[2]!.get("x")).toBe(3);
  });

  test("collate aggregates records through InterceptReceiver", () => {
    const receiver = new InterceptReceiver();
    const op = createOperation(
      "collate",
      ["--key", "group", "-a", "count"],
      receiver,
    );

    op.acceptRecord(new Record({ group: "a", val: 1 }));
    op.acceptRecord(new Record({ group: "b", val: 2 }));
    op.acceptRecord(new Record({ group: "a", val: 3 }));
    op.finish();

    expect(receiver.recordCount).toBe(2);
    // collate produces one record per group
    const groups = receiver.records.map((r) => r.get("group")).sort();
    expect(groups).toEqual(["a", "b"]);
  });

  test("totable produces lines (not records) through InterceptReceiver", () => {
    const receiver = new InterceptReceiver();
    const op = createOperation("totable", [], receiver);

    op.acceptRecord(new Record({ name: "alice", age: 30 }));
    op.acceptRecord(new Record({ name: "bob", age: 25 }));
    op.finish();

    // totable outputs text lines, not records
    expect(receiver.recordCount).toBe(0);
    expect(receiver.records.length).toBe(0);
    expect(receiver.lines.length).toBeGreaterThan(0);
    // Should contain a header and data rows
    const allText = receiver.lines.join("\n");
    expect(allText).toContain("alice");
    expect(allText).toContain("bob");
  });

  test("toprettyprint produces lines through InterceptReceiver", () => {
    const receiver = new InterceptReceiver();
    const op = createOperation("toprettyprint", [], receiver);

    op.acceptRecord(new Record({ x: 1, y: "hello" }));
    op.finish();

    expect(receiver.recordCount).toBe(0);
    expect(receiver.records.length).toBe(0);
    expect(receiver.lines.length).toBeGreaterThan(0);
    const allText = receiver.lines.join("\n");
    expect(allText).toContain("hello");
  });

  test("tocsv produces lines through InterceptReceiver", () => {
    const receiver = new InterceptReceiver();
    const op = createOperation("tocsv", [], receiver);

    op.acceptRecord(new Record({ name: "alice", age: 30 }));
    op.acceptRecord(new Record({ name: "bob", age: 25 }));
    op.finish();

    expect(receiver.recordCount).toBe(0);
    expect(receiver.records.length).toBe(0);
    expect(receiver.lines.length).toBeGreaterThan(0);
    const allText = receiver.lines.join("\n");
    expect(allText).toContain("alice");
    expect(allText).toContain("bob");
  });
});

// ── Text output through executor pipeline ─────────────────────────────────

describe("Text output operations in executor pipeline", () => {
  const inputRecords = [
    new Record({ name: "alice", age: 30 }),
    new Record({ name: "bob", age: 25 }),
  ];
  const input: InputSource = {
    id: "in1",
    source: { kind: "stdin-capture", records: inputRecords },
    label: "test input",
  };

  test("totable stage captures lines in CachedResult", async () => {
    const stages = [
      makeStage("s1", "grep", ["true"], null, 0),
      makeStage("s2", "totable", [], "s1", 1),
    ];
    const state = makePipelineState(stages, input);

    const result = await executeToStage(state, "s2");

    // totable produces lines, not records
    expect(result.records.length).toBe(0);
    expect(result.lines.length).toBeGreaterThan(0);
    const allText = result.lines.join("\n");
    expect(allText).toContain("alice");
    expect(allText).toContain("bob");
  });

  test("toprettyprint stage captures lines in CachedResult", async () => {
    const stages = [
      makeStage("s1", "grep", ["true"], null, 0),
      makeStage("s2", "toprettyprint", [], "s1", 1),
    ];
    const state = makePipelineState(stages, input);

    const result = await executeToStage(state, "s2");

    expect(result.records.length).toBe(0);
    expect(result.lines.length).toBeGreaterThan(0);
    const allText = result.lines.join("\n");
    expect(allText).toContain("alice");
  });

  test("tocsv stage captures lines in CachedResult", async () => {
    const stages = [
      makeStage("s1", "grep", ["true"], null, 0),
      makeStage("s2", "tocsv", [], "s1", 1),
    ];
    const state = makePipelineState(stages, input);

    const result = await executeToStage(state, "s2");

    expect(result.records.length).toBe(0);
    expect(result.lines.length).toBeGreaterThan(0);
    const allText = result.lines.join("\n");
    expect(allText).toContain("alice");
  });
});
