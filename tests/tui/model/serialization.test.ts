import { describe, test, expect } from "bun:test";
import {
  exportAsPipeScript,
  exportAsChainCommand,
  shellEscape,
} from "../../../src/tui/model/serialization.ts";
import type {
  PipelineState,
  Stage,
  InputSource,
  CacheConfig,
  InspectorState,
} from "../../../src/tui/model/types.ts";

// ── Helpers ──────────────────────────────────────────────────────────

function makeStage(
  id: string,
  opName: string,
  args: string[],
  parentId: string | null,
  position: number,
  enabled = true,
): Stage {
  return {
    id,
    config: { operationName: opName, args, enabled },
    parentId,
    childIds: [],
    forkId: "main",
    position,
  };
}

function makePipelineState(
  stages: Stage[],
  input?: InputSource,
): PipelineState {
  const stageMap = new Map<string, Stage>();
  for (const s of stages) {
    stageMap.set(s.id, s);
  }

  for (const s of stages) {
    if (s.parentId) {
      const parent = stageMap.get(s.parentId);
      if (parent && !parent.childIds.includes(s.id)) {
        parent.childIds.push(s.id);
      }
    }
  }

  const defaultInput: InputSource = input ?? {
    id: "in1",
    source: { kind: "stdin-capture", records: [] },
    label: "test",
  };

  const cacheConfig: CacheConfig = {
    maxMemoryBytes: 100 * 1024 * 1024,
    cachePolicy: "all",
    pinnedStageIds: new Set(),
  };

  const inspector: InspectorState = {
    viewMode: "table",
    scrollOffset: 0,
    searchQuery: null,
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
    inputs: new Map([[defaultInput.id, defaultInput]]),
    activeInputId: defaultInput.id,
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
    sessionDir: "/tmp/recs-tui-test",
  };
}

// ── shellEscape tests ────────────────────────────────────────────────

describe("shellEscape", () => {
  test("passes through simple strings", () => {
    expect(shellEscape("hello")).toBe("hello");
    expect(shellEscape("--key")).toBe("--key");
    expect(shellEscape("x=n")).toBe("x=n");
    expect(shellEscape("foo/bar")).toBe("foo/bar");
  });

  test("wraps strings with spaces in single quotes", () => {
    expect(shellEscape("hello world")).toBe("'hello world'");
  });

  test("wraps strings with special chars in single quotes", () => {
    expect(shellEscape("{{x}} > 2")).toBe("'{{x}} > 2'");
    expect(shellEscape("r.name === 'Alice'")).toBe("$'r.name === \\'Alice\\''");
  });

  test("handles empty string", () => {
    expect(shellEscape("")).toBe("''");
  });

  test("handles strings with single quotes using $'...' syntax", () => {
    const result = shellEscape("it's a test");
    expect(result).toBe("$'it\\'s a test'");
  });
});

// ── exportAsPipeScript tests ─────────────────────────────────────────

describe("exportAsPipeScript", () => {
  test("exports empty pipeline", () => {
    const state = makePipelineState([]);
    const result = exportAsPipeScript(state);
    expect(result).toBe("#!/usr/bin/env bash\n");
  });

  test("exports single stage", () => {
    const stages = [makeStage("s1", "grep", ["{{x}} > 2"], null, 0)];
    const state = makePipelineState(stages);
    const result = exportAsPipeScript(state);

    expect(result).toContain("#!/usr/bin/env bash");
    expect(result).toContain("recs grep '{{x}} > 2'");
  });

  test("exports multi-stage pipeline with pipe operators", () => {
    const stages = [
      makeStage("s1", "grep", ["{{x}} > 2"], null, 0),
      makeStage("s2", "sort", ["--key", "x=n"], "s1", 1),
      makeStage("s3", "totable", [], "s2", 2),
    ];
    const state = makePipelineState(stages);
    const result = exportAsPipeScript(state);

    expect(result).toContain("#!/usr/bin/env bash");
    expect(result).toContain("recs grep '{{x}} > 2'");
    expect(result).toContain("| recs sort --key x=n");
    expect(result).toContain("| recs totable");
    // Multi-line pipe format
    expect(result).toContain("\\\n");
  });

  test("includes input file path", () => {
    const stages = [makeStage("s1", "grep", ["{{x}} > 2"], null, 0)];
    const input: InputSource = {
      id: "in1",
      source: { kind: "file", path: "/tmp/data.jsonl" },
      label: "data.jsonl",
    };
    const state = makePipelineState(stages, input);
    const result = exportAsPipeScript(state);

    expect(result).toContain("recs grep '{{x}} > 2' /tmp/data.jsonl");
  });

  test("skips disabled stages", () => {
    const stages = [
      makeStage("s1", "grep", ["{{x}} > 2"], null, 0),
      makeStage("s2", "sort", ["--key", "x=n"], "s1", 1, false), // disabled
      makeStage("s3", "totable", [], "s2", 2),
    ];
    const state = makePipelineState(stages);
    const result = exportAsPipeScript(state);

    expect(result).toContain("recs grep");
    expect(result).not.toContain("recs sort");
    expect(result).toContain("recs totable");
  });

  test("escapes special characters in args", () => {
    const stages = [
      makeStage("s1", "xform", ["{{name}} = 'Alice & Bob'"], null, 0),
    ];
    const state = makePipelineState(stages);
    const result = exportAsPipeScript(state);

    // The arg should be escaped using $'...' syntax (single quotes inside)
    expect(result).toContain("$'");
    expect(result).toContain("recs xform");
  });

  test("escapes file paths with spaces", () => {
    const stages = [makeStage("s1", "grep", ["{{x}} > 2"], null, 0)];
    const input: InputSource = {
      id: "in1",
      source: { kind: "file", path: "/tmp/my data/file name.jsonl" },
      label: "file name.jsonl",
    };
    const state = makePipelineState(stages, input);
    const result = exportAsPipeScript(state);

    expect(result).toContain("'/tmp/my data/file name.jsonl'");
  });
});

// ── exportAsChainCommand tests ───────────────────────────────────────

describe("exportAsChainCommand", () => {
  test("exports empty pipeline", () => {
    const state = makePipelineState([]);
    expect(exportAsChainCommand(state)).toBe("recs chain");
  });

  test("exports single stage", () => {
    const stages = [makeStage("s1", "grep", ["{{x}} > 2"], null, 0)];
    const state = makePipelineState(stages);
    const result = exportAsChainCommand(state);

    expect(result).toBe("recs chain grep '{{x}} > 2'");
  });

  test("exports multi-stage pipeline with \\| separator", () => {
    const stages = [
      makeStage("s1", "grep", ["{{x}} > 2"], null, 0),
      makeStage("s2", "sort", ["--key", "x=n"], "s1", 1),
      makeStage("s3", "totable", [], "s2", 2),
    ];
    const state = makePipelineState(stages);
    const result = exportAsChainCommand(state);

    expect(result).toBe(
      "recs chain grep '{{x}} > 2' \\| sort --key x=n \\| totable",
    );
  });

  test("skips disabled stages", () => {
    const stages = [
      makeStage("s1", "grep", ["{{x}} > 2"], null, 0),
      makeStage("s2", "sort", ["--key", "x=n"], "s1", 1, false), // disabled
      makeStage("s3", "totable", [], "s2", 2),
    ];
    const state = makePipelineState(stages);
    const result = exportAsChainCommand(state);

    expect(result).toBe("recs chain grep '{{x}} > 2' \\| totable");
  });

  test("handles args with multiple flags", () => {
    const stages = [
      makeStage(
        "s1",
        "collate",
        ["--key", "group", "-a", "count", "-a", "sum,value"],
        null,
        0,
      ),
    ];
    const state = makePipelineState(stages);
    const result = exportAsChainCommand(state);

    expect(result).toBe("recs chain collate --key group -a count -a sum,value");
  });
});
