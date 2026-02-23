/**
 * Comprehensive Unicode/UTF-8 tests for the Explorer pipeline builder.
 *
 * RecordStream has Perl heritage where Unicode handling was problematic.
 * These tests verify that the TypeScript/Bun implementation handles
 * Unicode correctly across all layers: Records, pipeline operations,
 * serialization, export, and display.
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
} from "../../../src/explorer/model/selectors.ts";
import {
  exportAsPipeScript,
  exportAsChainCommand,
  shellEscape,
} from "../../../src/explorer/model/serialization.ts";
import { InterceptReceiver } from "../../../src/explorer/executor/intercept-receiver.ts";
import { createOperation } from "../../../src/operations/transform/chain.ts";
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
  args: string[],
): PipelineState {
  const config: StageConfig = {
    operationName: opName,
    args,
    enabled: true,
  };
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

// ── 1. Records with unicode field names ──────────────────────────────

describe("Records with unicode field names", () => {
  test("emoji field names", () => {
    const record = new Record({ "🔑": "key-value", "🏠": "home", "🎉": 42 });
    expect(record.get("🔑")).toBe("key-value");
    expect(record.get("🏠")).toBe("home");
    expect(record.get("🎉")).toBe(42);
    expect(record.keys()).toContain("🔑");
  });

  test("CJK field names", () => {
    const record = new Record({ "名前": "太郎", "年齢": 25, "住所": "東京" });
    expect(record.get("名前")).toBe("太郎");
    expect(record.get("年齢")).toBe(25);
    expect(record.has("住所")).toBe(true);
  });

  test("accented/diacritical field names", () => {
    const record = new Record({ "café": "latte", "naïve": true, "über": "cool" });
    expect(record.get("café")).toBe("latte");
    expect(record.get("naïve")).toBe(true);
    expect(record.get("über")).toBe("cool");
  });

  test("RTL text field names (Arabic/Hebrew)", () => {
    const record = new Record({ "عربي": "arabic", "עברית": "hebrew" });
    expect(record.get("عربي")).toBe("arabic");
    expect(record.get("עברית")).toBe("hebrew");
    expect(record.keys()).toHaveLength(2);
  });

  test("mixed-script field names in same record", () => {
    const record = new Record({
      name: "English",
      "名前": "Japanese",
      "이름": "Korean",
      "имя": "Russian",
      "🔑": "emoji",
    });
    expect(record.keys()).toHaveLength(5);
    expect(record.get("이름")).toBe("Korean");
    expect(record.get("имя")).toBe("Russian");
  });

  test("clone preserves unicode field names", () => {
    const original = new Record({ "🎉": "party", "名前": "太郎" });
    const cloned = original.clone();
    expect(cloned.get("🎉")).toBe("party");
    expect(cloned.get("名前")).toBe("太郎");

    // Mutation of clone does not affect original
    cloned.set("🎉", "changed");
    expect(original.get("🎉")).toBe("party");
  });

  test("rename with unicode field names", () => {
    const record = new Record({ "old_name": "value" });
    record.rename("old_name", "名前");
    expect(record.get("名前")).toBe("value");
    expect(record.has("old_name")).toBe(false);
  });

  test("pruneTo with unicode field names", () => {
    const record = new Record({ "名前": "太郎", "年齢": 25, "住所": "東京" });
    record.pruneTo("名前", "年齢");
    expect(record.has("名前")).toBe(true);
    expect(record.has("年齢")).toBe(true);
    expect(record.has("住所")).toBe(false);
  });

  test("toJSON roundtrip preserves unicode", () => {
    const original = new Record({ "🔑": "émoji", "名前": "太郎" });
    const json = original.toJSON();
    const restored = new Record(json);
    expect(restored.get("🔑")).toBe("émoji");
    expect(restored.get("名前")).toBe("太郎");
  });

  test("toString/fromJSON roundtrip preserves unicode", () => {
    const original = new Record({ "🎵": "music", "café": "latte" });
    const serialized = original.toString();
    const parsed = Record.fromJSON(serialized);
    expect(parsed.get("🎵")).toBe("music");
    expect(parsed.get("café")).toBe("latte");
  });
});

// ── 2. Records with unicode values ───────────────────────────────────

describe("Records with unicode values", () => {
  test("multi-byte emoji values", () => {
    const record = new Record({
      simple: "😀",
      family: "👨‍👩‍👧‍👦",
      flag: "🇯🇵",
      skin: "👋🏽",
    });
    expect(record.get("simple")).toBe("😀");
    expect(record.get("family")).toBe("👨‍👩‍👧‍👦");
    expect(record.get("flag")).toBe("🇯🇵");
    expect(record.get("skin")).toBe("👋🏽");
  });

  test("CJK text values", () => {
    const record = new Record({
      japanese: "日本語テスト",
      chinese: "中文测试",
      korean: "한국어 테스트",
    });
    expect(record.get("japanese")).toBe("日本語テスト");
    expect(record.get("chinese")).toBe("中文测试");
    expect(record.get("korean")).toBe("한국어 테스트");
  });

  test("Devanagari and other Indic scripts", () => {
    const record = new Record({
      hindi: "हिन्दी",
      tamil: "தமிழ்",
      bengali: "বাংলা",
    });
    expect(record.get("hindi")).toBe("हिन्दी");
    expect(record.get("tamil")).toBe("தமிழ்");
    expect(record.get("bengali")).toBe("বাংলা");
  });

  test("combining characters", () => {
    // é can be a single codepoint (U+00E9) or e + combining acute (U+0065 U+0301)
    const precomposed = "é"; // U+00E9
    const decomposed = "e\u0301"; // e + combining acute accent

    const record = new Record({ precomposed, decomposed });
    expect(record.get("precomposed")).toBe(precomposed);
    expect(record.get("decomposed")).toBe(decomposed);

    // These are different strings in JavaScript
    expect(precomposed).not.toBe(decomposed);
    // But they are equal when normalized
    expect(precomposed.normalize("NFC")).toBe(decomposed.normalize("NFC"));
  });

  test("zero-width joiners and other invisible characters", () => {
    const zwj = "\u200D"; // zero-width joiner
    const zwnj = "\u200C"; // zero-width non-joiner
    const record = new Record({
      with_zwj: `a${zwj}b`,
      with_zwnj: `a${zwnj}b`,
      zwsp: "a\u200Bb", // zero-width space
    });
    expect(record.get("with_zwj")).toBe(`a${zwj}b`);
    expect(record.get("with_zwnj")).toBe(`a${zwnj}b`);
  });

  test("surrogate-pair characters (astral plane)", () => {
    // Characters outside BMP require surrogate pairs in UTF-16
    const mathAlpha = "𝕳𝖊𝖑𝖑𝖔"; // Mathematical Fraktur
    const musical = "𝄞"; // Musical symbol G clef (U+1D11E)
    const ancient = "𐀀"; // Linear B Syllable (U+10000)

    const record = new Record({ math: mathAlpha, music: musical, ancient });
    expect(record.get("math")).toBe(mathAlpha);
    expect(record.get("music")).toBe(musical);
    expect(record.get("ancient")).toBe(ancient);
  });

  test("mixed ASCII and unicode in same value", () => {
    const record = new Record({
      mixed: "Hello 世界! 🌍 café",
      path: "/data/日本語/file.txt",
    });
    expect(record.get("mixed")).toBe("Hello 世界! 🌍 café");
    expect(record.get("path")).toBe("/data/日本語/file.txt");
  });
});

// ── 3. Pipeline operations with unicode ──────────────────────────────

describe("Pipeline operations with unicode", () => {
  test("grep filters records with unicode field values", async () => {
    let state = createInitialState();
    const records = [
      new Record({ name: "Alice", lang: "English" }),
      new Record({ name: "太郎", lang: "日本語" }),
      new Record({ name: "Pierre", lang: "Français" }),
    ];
    state = addInput(state, records);

    // Grep for records where lang contains non-ASCII characters
    // Use a simple expression that matches the Japanese entry
    state = addStage(state, "grep", ['{{lang}} === "日本語"']);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(1);
    expect(result.records[0]!.get("name")).toBe("太郎");
  });

  test("grep with unicode in expression text", async () => {
    let state = createInitialState();
    const records = [
      new Record({ city: "東京", population: 14000000 }),
      new Record({ city: "大阪", population: 2700000 }),
      new Record({ city: "New York", population: 8300000 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ['{{city}} === "東京"']);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(1);
    expect(result.records[0]!.get("city")).toBe("東京");
  });

  test("sort with unicode string values (lexical)", async () => {
    let state = createInitialState();
    const records = [
      new Record({ name: "Charlie" }),
      new Record({ name: "Alice" }),
      new Record({ name: "太郎" }),
      new Record({ name: "Bob" }),
    ];
    state = addInput(state, records);

    state = addStage(state, "sort", ["--key", "name"]);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(4);
    // Lexical sort should put unicode characters after ASCII
    const names = result.records.map((r) => r.get("name"));
    expect(names).toContain("Alice");
    expect(names).toContain("太郎");
    // Verify it's actually sorted (each name <= next name lexicographically)
    for (let i = 0; i < names.length - 1; i++) {
      expect(String(names[i]) <= String(names[i + 1])).toBe(true);
    }
  });

  test("sort with emoji field names", async () => {
    let state = createInitialState();
    const records = [
      new Record({ "🔢": 3, label: "c" }),
      new Record({ "🔢": 1, label: "a" }),
      new Record({ "🔢": 2, label: "b" }),
    ];
    state = addInput(state, records);

    state = addStage(state, "sort", ["--key", "🔢=n"]);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(3);
    expect(result.records[0]!.get("🔢")).toBe(1);
    expect(result.records[1]!.get("🔢")).toBe(2);
    expect(result.records[2]!.get("🔢")).toBe(3);
  });

  test("xform with unicode field names", async () => {
    let state = createInitialState();
    const records = [
      new Record({ x: 10 }),
      new Record({ x: 20 }),
    ];
    state = addInput(state, records);

    // Use xform to create a field with a unicode name
    state = addStage(state, "xform", ["{{結果}} = {{x}} * 2"]);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("結果")).toBe(20);
    expect(result.records[1]!.get("結果")).toBe(40);
    expect(result.fieldNames).toContain("結果");
  });

  test("collate with unicode group keys", async () => {
    let state = createInitialState();
    const records = [
      new Record({ group: "日本", val: 10 }),
      new Record({ group: "中国", val: 20 }),
      new Record({ group: "日本", val: 30 }),
      new Record({ group: "中国", val: 5 }),
    ];
    state = addInput(state, records);

    state = addStage(state, "collate", ["--key", "group", "-a", "count"]);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(2);

    const groups = result.records.map((r) => ({
      group: r.get("group"),
      count: r.get("count"),
    }));
    const sorted = groups.sort((a, b) =>
      String(a.group).localeCompare(String(b.group)),
    );
    expect(sorted[0]!.count).toBe(2);
    expect(sorted[1]!.count).toBe(2);
  });

  test("multi-stage pipeline with unicode throughout", async () => {
    let state = createInitialState();
    const records = [
      new Record({ "名前": "太郎", "年齢": 30, "市": "東京" }),
      new Record({ "名前": "花子", "年齢": 20, "市": "大阪" }),
      new Record({ "名前": "一郎", "年齢": 35, "市": "東京" }),
      new Record({ "名前": "美咲", "年齢": 25, "市": "京都" }),
    ];
    state = addInput(state, records);

    // grep: age > 25
    state = addStage(state, "grep", ["{{年齢}} > 25"]);
    // sort: by age ascending
    state = addStage(state, "sort", ["--key", "年齢=n"]);
    const sortId = getLastStageId(state);

    const result = await executeToStage(state, sortId);
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("名前")).toBe("太郎");
    expect(result.records[0]!.get("年齢")).toBe(30);
    expect(result.records[1]!.get("名前")).toBe("一郎");
    expect(result.records[1]!.get("年齢")).toBe(35);
  });

  test("grep with emoji values", async () => {
    let state = createInitialState();
    const records = [
      new Record({ status: "✅", task: "done" }),
      new Record({ status: "❌", task: "failed" }),
      new Record({ status: "✅", task: "also done" }),
      new Record({ status: "⏳", task: "pending" }),
    ];
    state = addInput(state, records);

    state = addStage(state, "grep", ['{{status}} === "✅"']);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(2);
    expect(result.records.every((r) => r.get("status") === "✅")).toBe(true);
  });
});

// ── 4. Direct operation tests with unicode (InterceptReceiver) ───────

describe("Direct operations with unicode (InterceptReceiver)", () => {
  test("grep filters with unicode expressions", () => {
    const receiver = new InterceptReceiver();
    const op = createOperation("grep", ['{{name}} === "太郎"'], receiver);

    op.acceptRecord(new Record({ name: "太郎" }));
    op.acceptRecord(new Record({ name: "花子" }));
    op.acceptRecord(new Record({ name: "太郎" }));
    op.finish();

    expect(receiver.recordCount).toBe(2);
    expect(receiver.records.every((r) => r.get("name") === "太郎")).toBe(true);
  });

  test("sort orders unicode strings correctly", () => {
    const receiver = new InterceptReceiver();
    const op = createOperation("sort", ["--key", "name"], receiver);

    op.acceptRecord(new Record({ name: "Charlie" }));
    op.acceptRecord(new Record({ name: "Alice" }));
    op.acceptRecord(new Record({ name: "太郎" }));
    op.acceptRecord(new Record({ name: "Bob" }));
    op.finish();

    expect(receiver.recordCount).toBe(4);
    const names = receiver.records.map((r) => String(r.get("name")));
    // Verify sorted order
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i]! <= names[i + 1]!).toBe(true);
    }
  });

  test("InterceptReceiver tracks unicode field names", () => {
    const receiver = new InterceptReceiver();
    const r1 = new Record({ "名前": "太郎", "年齢": 30 });
    const r2 = new Record({ "名前": "花子", "市": "東京" });

    receiver.acceptRecord(r1);
    receiver.acceptRecord(r2);
    receiver.finish();

    expect(receiver.fieldNames).toEqual(new Set(["名前", "年齢", "市"]));
  });

  test("InterceptReceiver clones records with unicode data", () => {
    const receiver = new InterceptReceiver();
    const original = new Record({ "🎉": "パーティー", "café": "latté" });

    receiver.acceptRecord(original);
    original.set("🎉", "changed");

    expect(receiver.records[0]!.get("🎉")).toBe("パーティー");
    expect(receiver.records[0]!.get("café")).toBe("latté");
  });
});

// ── 5. Column width calculation with unicode ─────────────────────────

describe("Column width calculation with unicode", () => {
  // Mirror the column width computation used in RecordTable and AddStageModal
  const COL_MIN = 4;
  const COL_MAX = 30;

  function computeColumnWidths(fields: string[], records: Record[]): number[] {
    return fields.map((field) => {
      let maxWidth = field.length;
      for (const record of records) {
        const val = record.get(field);
        const str = val === null || val === undefined ? "" : String(val);
        maxWidth = Math.max(maxWidth, str.length);
      }
      return Math.min(Math.max(maxWidth, COL_MIN), COL_MAX);
    });
  }

  test("ASCII values use .length correctly", () => {
    const fields = ["name"];
    const records = [new Record({ name: "Alice" })];
    const widths = computeColumnWidths(fields, records);
    expect(widths[0]).toBe(5); // "Alice".length === 5
  });

  test("CJK characters have correct .length (1 per char in JS)", () => {
    // NOTE: In JS, each CJK character is a single code unit, so .length = 1
    // However, CJK chars are visually double-width in terminals.
    // This test documents the CURRENT behavior (using .length).
    const fields = ["city"];
    const records = [new Record({ city: "東京" })];
    const widths = computeColumnWidths(fields, records);
    // "東京".length === 2 in JavaScript, but visually it's 4 cells wide
    expect(widths[0]).toBe(COL_MIN); // 2 < COL_MIN=4, so COL_MIN
  });

  test("emoji characters have varying .length", () => {
    // Simple emoji: "😀".length === 2 (surrogate pair)
    expect("😀".length).toBe(2);
    // Family emoji with ZWJ: much longer
    expect("👨‍👩‍👧‍👦".length).toBe(11); // 4 emoji + 3 ZWJ
    // Flag emoji: "🇯🇵".length === 4 (two regional indicator symbols)
    expect("🇯🇵".length).toBe(4);
  });

  test("column width with emoji field names", () => {
    const fields = ["🔑"]; // length 2 (surrogate pair)
    const records = [new Record({ "🔑": "value" })];
    const widths = computeColumnWidths(fields, records);
    expect(widths[0]).toBe(5); // "value".length = 5 > "🔑".length = 2
  });

  test("column width with CJK field names", () => {
    const fields = ["名前"]; // length 2
    const records = [new Record({ "名前": "x" })];
    const widths = computeColumnWidths(fields, records);
    expect(widths[0]).toBe(COL_MIN); // max(2, 1) = 2 < COL_MIN=4
  });

  test("combining characters affect .length", () => {
    // Precomposed é (U+00E9) = length 1
    expect("é".length).toBe(1);
    // Decomposed e + combining acute (U+0065 U+0301) = length 2
    expect("e\u0301".length).toBe(2);

    const fields = ["val"];
    const precomposed = [new Record({ val: "café" })]; // length 4
    const decomposed = [new Record({ val: "cafe\u0301" })]; // length 5

    const w1 = computeColumnWidths(fields, precomposed);
    const w2 = computeColumnWidths(fields, decomposed);
    expect(w1[0]).toBe(4); // "café".length
    expect(w2[0]).toBe(5); // "cafe\u0301".length
  });
});

// ── 6. Session serialization roundtrip with unicode ──────────────────

describe("Session serialization roundtrip with unicode", () => {
  let tempDir: string;
  let manager: SessionManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "recs-unicode-test-"));
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("save/load preserves unicode stage args", async () => {
    let state = createInitialState();
    state = addStage(state, "grep", ['{{名前}} === "太郎"']);
    state = addStage(state, "sort", ["--key", "年齢=n"]);

    await manager.save(state);
    const loaded = await manager.load(state.sessionId);
    const hydrated = manager.hydrate(loaded);

    const stages = Array.from(hydrated.stages.values());
    expect(stages[0]!.config.args).toEqual(['{{名前}} === "太郎"']);
    expect(stages[1]!.config.args).toEqual(["--key", "年齢=n"]);
  });

  test("save/load preserves unicode session name", async () => {
    let state = createInitialState();
    state = addStage(state, "grep", ["true"]);
    state = { ...state, sessionName: "テスト セッション 🎉" };

    await manager.save(state);
    const loaded = await manager.load(state.sessionId);
    expect(loaded.name).toBe("テスト セッション 🎉");

    const hydrated = manager.hydrate(loaded);
    expect(hydrated.sessionName).toBe("テスト セッション 🎉");
  });

  test("save/load preserves unicode input labels", async () => {
    let state = createInitialState();
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: "/tmp/日本語データ.jsonl" },
      label: "日本語データ.jsonl",
    });
    state = addStage(state, "grep", ["true"]);

    await manager.save(state);
    const loaded = await manager.load(state.sessionId);
    const hydrated = manager.hydrate(loaded);

    const inputs = Array.from(hydrated.inputs.values());
    const fileInput = inputs.find(
      (i) => i.source.kind === "file",
    );
    expect(fileInput).toBeDefined();
    expect(fileInput!.label).toBe("日本語データ.jsonl");
    if (fileInput!.source.kind === "file") {
      expect(fileInput!.source.path).toBe("/tmp/日本語データ.jsonl");
    }
  });

  test("save/load preserves unicode in undo/redo stack", async () => {
    let state = createInitialState();
    state = addStage(state, "grep", ['{{名前}} === "太郎"']);
    state = addStage(state, "sort", ["--key", "年齢=n"]);
    // Undo to push sort onto redo stack
    state = dispatch(state, { type: "UNDO" });

    await manager.save(state);
    const loaded = await manager.load(state.sessionId);
    const hydrated = manager.hydrate(loaded);

    expect(hydrated.undoStack.length).toBeGreaterThanOrEqual(1);
    expect(hydrated.redoStack.length).toBeGreaterThanOrEqual(1);

    // The remaining stage should have unicode args
    const stages = Array.from(hydrated.stages.values());
    const grepStage = stages.find(
      (s) => s.config.operationName === "grep",
    );
    expect(grepStage).toBeDefined();
    expect(grepStage!.config.args[0]).toBe('{{名前}} === "太郎"');
  });

  test("list returns unicode session names in metadata", async () => {
    let state = createInitialState();
    state = addStage(state, "grep", ["true"]);
    state = { ...state, sessionName: "日本語テスト" };
    await manager.save(state);

    const sessions = await manager.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.name).toBe("日本語テスト");
  });

  test("saveAs with unicode name", async () => {
    let state = createInitialState();
    state = addStage(state, "grep", ["true"]);
    const newId = await manager.saveAs(state, "分析結果 🔍");

    const loaded = await manager.load(newId);
    expect(loaded.name).toBe("分析結果 🔍");
  });

  test("rename with unicode name", async () => {
    let state = createInitialState();
    state = addStage(state, "grep", ["true"]);
    state = { ...state, sessionName: "old" };
    await manager.save(state);

    await manager.rename(state.sessionId, "新しい名前 ✨");
    const loaded = await manager.load(state.sessionId);
    expect(loaded.name).toBe("新しい名前 ✨");
  });
});

// ── 7. Export with unicode ───────────────────────────────────────────

describe("Export with unicode", () => {
  test("shellEscape handles unicode characters", () => {
    // Unicode characters match SHELL_SPECIAL pattern, so they get quoted
    const result = shellEscape("日本語");
    expect(result).toBe("'日本語'");
  });

  test("shellEscape handles emoji", () => {
    const result = shellEscape("🎉party");
    expect(result).toBe("'🎉party'");
  });

  test("shellEscape handles mixed unicode and special chars", () => {
    const result = shellEscape("{{名前}} > 0");
    expect(result).toBe("'{{名前}} > 0'");
  });

  test("shellEscape handles unicode with single quotes", () => {
    const result = shellEscape("it's 日本語");
    expect(result).toBe("$'it\\'s 日本語'");
  });

  test("exportAsPipeScript with unicode stage args", () => {
    let state = createInitialState();
    state = addInput(state, []);
    state = addStage(state, "grep", ['{{名前}} === "太郎"']);
    state = addStage(state, "sort", ["--key", "年齢=n"]);

    const script = exportAsPipeScript(state);
    expect(script).toContain("#!/usr/bin/env bash");
    expect(script).toContain("recs grep");
    expect(script).toContain("名前");
    expect(script).toContain("太郎");
    expect(script).toContain("年齢");
  });

  test("exportAsChainCommand with unicode stage args", () => {
    let state = createInitialState();
    state = addInput(state, []);
    state = addStage(state, "grep", ['{{名前}} === "太郎"']);
    state = addStage(state, "sort", ["--key", "年齢=n"]);

    const chain = exportAsChainCommand(state);
    expect(chain).toContain("recs chain");
    expect(chain).toContain("名前");
    expect(chain).toContain("年齢");
  });

  test("exportAsPipeScript with unicode file path", () => {
    let state = createInitialState();
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: "/tmp/データ/テスト.jsonl" },
      label: "テスト.jsonl",
    });
    state = addStage(state, "grep", ["true"]);

    const script = exportAsPipeScript(state);
    expect(script).toContain("テスト.jsonl");
    expect(script).toContain("データ");
  });

  test("export pipe script with emoji in args", () => {
    let state = createInitialState();
    state = addInput(state, []);
    state = addStage(state, "grep", ['{{status}} === "✅"']);

    const script = exportAsPipeScript(state);
    expect(script).toContain("✅");
  });
});

// ── 8. Stream preview logic with unicode ─────────────────────────────

describe("Stream preview with unicode", () => {
  // Mirror the tree flattening logic from AddStageModal
  interface TreeRow {
    depth: number;
    label: string;
    value: unknown;
    isContainer: boolean;
    path: string;
    childCount: number;
  }

  function flattenValue(
    value: unknown,
    collapsed: Set<string>,
    parentPath: string,
    depth: number,
    label: string,
  ): TreeRow[] {
    const path = parentPath ? `${parentPath}.${label}` : label;

    if (value === null || value === undefined) {
      return [{ depth, label, value: null, isContainer: false, path, childCount: 0 }];
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value as object);
      const row: TreeRow = { depth, label, value, isContainer: true, path, childCount: keys.length };
      const rows: TreeRow[] = [row];
      if (!collapsed.has(path)) {
        for (const key of keys) {
          rows.push(...flattenValue((value as { [k: string]: unknown })[key], collapsed, path, depth + 1, key));
        }
      }
      return rows;
    }

    if (Array.isArray(value)) {
      const row: TreeRow = { depth, label, value, isContainer: true, path, childCount: value.length };
      const rows: TreeRow[] = [row];
      if (!collapsed.has(path)) {
        for (let i = 0; i < value.length; i++) {
          rows.push(...flattenValue(value[i], collapsed, path, depth + 1, `[${i}]`));
        }
      }
      return rows;
    }

    return [{ depth, label, value, isContainer: false, path, childCount: 0 }];
  }

  function flattenRecord(record: Record, collapsed: Set<string>): TreeRow[] {
    const data = record.toJSON();
    const rows: TreeRow[] = [];
    for (const key of Object.keys(data)) {
      rows.push(...flattenValue(data[key]!, collapsed, "", 0, key));
    }
    return rows;
  }

  test("flattens record with unicode field names", () => {
    const record = new Record({ "名前": "太郎", "年齢": 30 });
    const rows = flattenRecord(record, new Set());
    expect(rows).toHaveLength(2);
    expect(rows[0]!.label).toBe("名前");
    expect(rows[0]!.value).toBe("太郎");
    expect(rows[1]!.label).toBe("年齢");
    expect(rows[1]!.value).toBe(30);
  });

  test("flattens record with emoji field names", () => {
    const record = new Record({ "🔑": "key-val", "🏠": "home-val" });
    const rows = flattenRecord(record, new Set());
    expect(rows).toHaveLength(2);
    expect(rows[0]!.label).toBe("🔑");
    expect(rows[0]!.value).toBe("key-val");
  });

  test("flattens nested objects with unicode keys", () => {
    const record = new Record({
      "メタ": { "名前": "太郎", "値": 42 },
    });
    const rows = flattenRecord(record, new Set());
    // メタ (container) + 名前 + 値 = 3 rows
    expect(rows).toHaveLength(3);
    expect(rows[0]!.label).toBe("メタ");
    expect(rows[0]!.isContainer).toBe(true);
    expect(rows[1]!.label).toBe("名前");
    expect(rows[1]!.value).toBe("太郎");
    expect(rows[2]!.label).toBe("値");
    expect(rows[2]!.value).toBe(42);
  });

  test("collapse works with unicode paths", () => {
    const record = new Record({
      "メタ": { "名前": "太郎", "値": 42 },
    });
    const collapsed = new Set(["メタ"]);
    const rows = flattenRecord(record, collapsed);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.label).toBe("メタ");
    expect(rows[0]!.isContainer).toBe(true);
  });

  test("unicode array values flatten correctly", () => {
    const record = new Record({
      "タグ": ["日本", "東京", "🎉"],
    });
    const rows = flattenRecord(record, new Set());
    expect(rows).toHaveLength(4); // container + 3 items
    expect(rows[0]!.label).toBe("タグ");
    expect(rows[0]!.isContainer).toBe(true);
    expect(rows[1]!.value).toBe("日本");
    expect(rows[2]!.value).toBe("東京");
    expect(rows[3]!.value).toBe("🎉");
  });
});

// ── 9. Edge cases ────────────────────────────────────────────────────

describe("Unicode edge cases", () => {
  test("BOM marker in record values", () => {
    const bom = "\uFEFF";
    const record = new Record({ text: `${bom}Hello` });
    expect(record.get("text")).toBe(`${bom}Hello`);
    // BOM is preserved in the string
    expect(String(record.get("text")).charCodeAt(0)).toBe(0xFEFF);
  });

  test("null bytes in strings", () => {
    const record = new Record({ text: "hello\0world" });
    expect(record.get("text")).toBe("hello\0world");
    expect(String(record.get("text")).length).toBe(11);
  });

  test("empty string vs unicode whitespace", () => {
    const record = new Record({
      empty: "",
      space: " ",
      nbsp: "\u00A0", // non-breaking space
      ideographic_space: "\u3000", // CJK ideographic space
      thin_space: "\u2009",
    });
    expect(record.get("empty")).toBe("");
    expect(record.get("nbsp")).toBe("\u00A0");
    expect(record.get("ideographic_space")).toBe("\u3000");
    expect(record.get("thin_space")).toBe("\u2009");
  });

  test("very long unicode strings", () => {
    const longCJK = "漢".repeat(10000);
    const record = new Record({ text: longCJK });
    expect(String(record.get("text")).length).toBe(10000);

    // Verify clone works with long unicode strings
    const cloned = record.clone();
    expect(String(cloned.get("text")).length).toBe(10000);
  });

  test("mixed direction text (LTR + RTL)", () => {
    const record = new Record({
      bidi: "Hello مرحبا World عالم",
      rtl_only: "عربي فقط",
      hebrew: "שלום עולם",
    });
    expect(record.get("bidi")).toBe("Hello مرحبا World عالم");
    expect(record.get("rtl_only")).toBe("عربي فقط");
    expect(record.get("hebrew")).toBe("שלום עולם");
  });

  test("mathematical and technical symbols", () => {
    const record = new Record({
      math: "∑∏∫∂∇",
      arrows: "←→↑↓⇐⇒",
      box: "┌─┐│└─┘",
      currency: "¥€£₹₩",
    });
    expect(record.get("math")).toBe("∑∏∫∂∇");
    expect(record.get("arrows")).toBe("←→↑↓⇐⇒");
  });

  test("control characters in strings", () => {
    const record = new Record({
      tab: "col1\tcol2",
      newline: "line1\nline2",
      cr: "text\r\nwith cr",
    });
    expect(record.get("tab")).toBe("col1\tcol2");
    expect(record.get("newline")).toBe("line1\nline2");

    // Verify JSON roundtrip preserves control chars
    const serialized = record.toString();
    const parsed = Record.fromJSON(serialized);
    expect(parsed.get("tab")).toBe("col1\tcol2");
    expect(parsed.get("newline")).toBe("line1\nline2");
  });

  test("Record.fromJSON with unicode JSON", () => {
    const json = '{"名前":"太郎","🎉":"パーティー","emoji":"👨‍👩‍👧‍👦"}';
    const record = Record.fromJSON(json);
    expect(record.get("名前")).toBe("太郎");
    expect(record.get("🎉")).toBe("パーティー");
    expect(record.get("emoji")).toBe("👨‍👩‍👧‍👦");
  });

  test("JSON roundtrip preserves all unicode categories", () => {
    const original = new Record({
      latin: "café",
      cjk: "日本語",
      emoji: "😀👨‍👩‍👧‍👦🇯🇵",
      arabic: "عربي",
      hebrew: "עברית",
      devanagari: "हिन्दी",
      cyrillic: "Русский",
      combining: "e\u0301",
      astral: "𝕳𝖊𝖑𝖑𝖔",
    });

    const serialized = original.toString();
    const restored = Record.fromJSON(serialized);

    for (const key of original.keys()) {
      expect(restored.get(key)).toBe(original.get(key));
    }
  });

  test("sort comparison with unicode strings", () => {
    const records = [
      new Record({ name: "中文" }),
      new Record({ name: "English" }),
      new Record({ name: "日本語" }),
      new Record({ name: "한국어" }),
    ];

    const sorted = Record.sort(records, "name");
    // Should not throw and should produce a stable order
    expect(sorted).toHaveLength(4);

    // Verify sort is stable: each pair should satisfy lexical comparison
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = String(sorted[i]!.get("name"));
      const b = String(sorted[i + 1]!.get("name"));
      expect(a <= b).toBe(true);
    }
  });

  test("sort comparison with numeric unicode field names", () => {
    const records = [
      new Record({ "数値": 30 }),
      new Record({ "数値": 10 }),
      new Record({ "数値": 20 }),
    ];

    const sorted = Record.sort(records, "数値=n");
    expect(sorted[0]!.get("数値")).toBe(10);
    expect(sorted[1]!.get("数値")).toBe(20);
    expect(sorted[2]!.get("数値")).toBe(30);
  });

  test("nested key access with unicode", () => {
    const record = new Record({
      "メタ": { "名前": "太郎" },
    });
    // Direct nested access using get on nested object
    const meta = record.get("メタ") as { "名前": string };
    expect(meta["名前"]).toBe("太郎");
  });
});

// ── 10. File I/O with unicode ────────────────────────────────────────

describe("File I/O with unicode content", () => {
  test("fromcsv with unicode content via file input", async () => {
    const csvContent = "名前,年齢,市\n太郎,30,東京\n花子,25,大阪\n";
    const tmpFile = `/tmp/recs-unicode-csv-${Date.now()}.csv`;
    await Bun.write(tmpFile, csvContent);

    let state = createInitialState();
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: tmpFile },
      label: "unicode.csv",
    });
    state = addStage(state, "fromcsv", ["--header"]);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("名前")).toBe("太郎");
    expect(result.records[0]!.get("年齢")).toBe("30");
    expect(result.records[0]!.get("市")).toBe("東京");
    expect(result.records[1]!.get("名前")).toBe("花子");

    // Verify field names include unicode
    expect(result.fieldNames).toContain("名前");
    expect(result.fieldNames).toContain("年齢");
    expect(result.fieldNames).toContain("市");

    const fs = await import("node:fs");
    fs.unlinkSync(tmpFile);
  });

  test("JSONL file with unicode records", async () => {
    const jsonlContent = [
      JSON.stringify({ "名前": "太郎", "emoji": "🎉" }),
      JSON.stringify({ "名前": "花子", "emoji": "🌸" }),
      "",
    ].join("\n");

    const tmpFile = `/tmp/recs-unicode-jsonl-${Date.now()}.jsonl`;
    await Bun.write(tmpFile, jsonlContent);

    let state = createInitialState();
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: tmpFile },
      label: "unicode.jsonl",
    });
    state = addStage(state, "grep", ["true"]);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(2);
    expect(result.records[0]!.get("名前")).toBe("太郎");
    expect(result.records[0]!.get("emoji")).toBe("🎉");
    expect(result.records[1]!.get("名前")).toBe("花子");
    expect(result.records[1]!.get("emoji")).toBe("🌸");

    const fs = await import("node:fs");
    fs.unlinkSync(tmpFile);
  });

  test("CSV with BOM marker", async () => {
    const bom = "\uFEFF";
    const csvContent = `${bom}name,value\nAlice,1\nBob,2\n`;
    const tmpFile = `/tmp/recs-bom-csv-${Date.now()}.csv`;
    await Bun.write(tmpFile, csvContent);

    let state = createInitialState();
    state = dispatch(state, {
      type: "ADD_INPUT",
      source: { kind: "file", path: tmpFile },
      label: "bom.csv",
    });
    state = addStage(state, "fromcsv", ["--header"]);
    const stageId = getLastStageId(state);

    const result = await executeToStage(state, stageId);
    expect(result.recordCount).toBe(2);
    // BOM may or may not be stripped by the CSV parser — document behavior
    const fieldNames = result.fieldNames;
    // The first field name might have BOM prefix
    const hasPlainName = fieldNames.includes("name");
    const hasBomName = fieldNames.includes(`${bom}name`);
    expect(hasPlainName || hasBomName).toBe(true);

    const fs = await import("node:fs");
    fs.unlinkSync(tmpFile);
  });
});
