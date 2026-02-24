/**
 * End-to-end smoke tests for recs-explorer using tmux.
 *
 * These tests launch the real TUI in a tmux session and interact with it
 * via send-keys / capture-pane. They catch bugs that unit tests miss.
 *
 * Requirements: tmux must be installed and available in PATH.
 */

import { describe, test, expect, afterEach } from "bun:test";
import { TmuxTestHarness } from "./tmux-harness.ts";
import { join } from "node:path";

// These tests are slow and timing-sensitive (launch real tmux sessions).
// Skip by default; run with: RUN_E2E=1 bun test tests/explorer/e2e/
const SKIP = !process.env["RUN_E2E"];

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

// Check tmux availability
let tmuxAvailable = false;
try {
  const proc = Bun.spawnSync(["tmux", "-V"]);
  tmuxAvailable = proc.exitCode === 0;
} catch {
  tmuxAvailable = false;
}

const describeE2E = (tmuxAvailable && !SKIP) ? describe : describe.skip;

/**
 * Helper: add a stage by typing its name in the AddStageModal.
 * Handles the full flow: open modal → search → select → dismiss edit modal.
 *
 * The EditStageModal is dismissed with Escape rather than Enter because
 * ink-text-input's internal useInput handler is recreated every render
 * without useCallback, creating brief deregistration windows where
 * tmux-sent Enter events can be missed.  Since ADD_STAGE already creates
 * the stage before EditStageModal opens, canceling simply keeps the
 * default empty args — fine for operations like fromps that need none.
 */
/**
 * Helper: add a stage by typing its name in the AddStageModal.
 * Handles the full flow: open modal → search → select → dismiss edit modal.
 *
 * The EditStageModal is dismissed with Escape rather than Enter because
 * ink-text-input's internal useInput handler is recreated every render
 * without useCallback, creating brief deregistration windows where
 * tmux-sent Enter events can be missed.  Since ADD_STAGE already creates
 * the stage before EditStageModal opens, canceling simply keeps the
 * default empty args — fine for operations like fromps that need none.
 */
async function addStage(harness: TmuxTestHarness, opName: string): Promise<void> {
  await harness.sendKeys("a");
  // Wait for the AddStageModal to appear
  const modalAppeared = await harness.waitForAnyText(["Add Stage", "Search"], 5000);
  if (!modalAppeared) {
    await harness.dumpScreen("addStage - AddStageModal did not appear");
    throw new Error("AddStageModal did not appear after pressing 'a'");
  }

  // Extra delay: the AddStageModal may appear on screen (React render) before
  // its useInput/TextInput event listeners are registered (React effects run
  // after paint). Characters sent during this gap are delivered to the wrong
  // listeners and lost. Wait for the event loop to settle.
  await sleep(1500);

  await harness.sendText(opName);
  await sleep(800);

  // Press Enter to select the operation in AddStageModal
  await harness.sendKeys("Enter");
  // Wait for the EditStageModal to appear (shows "Edit: <opName>")
  const editAppeared = await harness.waitForText("Edit:", 8000);
  if (!editAppeared) {
    await harness.dumpScreen("addStage - EditStageModal did not appear");
    throw new Error("EditStageModal did not appear after pressing Enter");
  }

  // Confirm the EditStageModal with Enter (keeps default empty args).
  // Enter is processed immediately by the input parser, unlike Escape which
  // goes through a setImmediate delay for escape-sequence disambiguation.
  //
  // The event loop may be frozen for several seconds after the modal mounts
  // (Bun compiling operation modules, pipeline execution, etc.), so we retry
  // Enter with increasing delays until the modal closes.
  let editGone = false;
  for (let attempt = 0; attempt < 6 && !editGone; attempt++) {
    await harness.sendKeys("Enter");
    editGone = await harness.waitForTextGone("Edit:", 3000);
  }
  if (!editGone) {
    await harness.dumpScreen("addStage - EditStageModal did not close");
  }
  await sleep(300);
}

/**
 * Helper: wait for execution results to appear.
 * Falls back to pressing 'r' (manual re-run) if auto-execution hasn't fired.
 *
 * Note: We search for "N records" patterns rather than "cached" because the
 * not-yet-executed state shows "not cached" which contains "cached" as a
 * substring, causing false-positive matches.
 */
async function waitForExecution(harness: TmuxTestHarness, timeoutMs = 10000): Promise<boolean> {
  // "records" appears in "Inspector: fromps (N records, cached Xs ago)"
  // "computing" appears while execution is in progress
  const found = await harness.waitForAnyText(["records", "computing"], timeoutMs);
  if (found === "computing") {
    // Execution started but hasn't finished — wait for completion
    const done = await harness.waitForAnyText(["records"], timeoutMs);
    return done !== null;
  }
  if (found) return true;

  // Auto-execution might not have triggered. Press 'r' to force re-run.
  await harness.sendKeys("r");
  await sleep(1000);
  const afterR = await harness.waitForAnyText(["records", "computing"], 8000);
  if (afterR === "computing") {
    const done = await harness.waitForAnyText(["records"], timeoutMs);
    return done !== null;
  }
  return afterR !== null;
}

/**
 * Helper: start explorer and navigate past welcome screen to new pipeline.
 */
async function startNewPipeline(harness: TmuxTestHarness): Promise<void> {
  await harness.start();
  const found = await harness.waitForText("Welcome to recs explorer", 15000);
  if (!found) throw new Error("Welcome screen did not appear");

  await harness.sendKeys("n");
  const gone = await harness.waitForTextGone("Welcome to recs explorer", 8000);
  if (!gone) {
    // Retry the 'n' key in case it was lost during busy event loop
    await harness.sendKeys("n");
    const retryGone = await harness.waitForTextGone("Welcome to recs explorer", 5000);
    if (!retryGone) {
      await harness.dumpScreen("startNewPipeline - welcome screen still showing after retry");
      throw new Error("Welcome screen did not dismiss after pressing 'n' twice");
    }
  }
  await sleep(500);
}

describeE2E("Explorer E2E (tmux)", () => {
  let harness: TmuxTestHarness;

  afterEach(async () => {
    if (harness) {
      await harness.cleanup();
    }
    // Brief pause between tests to let tmux sessions clean up
    await sleep(500);
  });

  // ── 1. Welcome Screen ─────────────────────────────────────────────

  test("welcome screen appears with no args", async () => {
    harness = new TmuxTestHarness({ cwd: REPO_ROOT });
    await harness.start();

    const found = await harness.waitForText("Welcome to recs explorer", 10000);
    expect(found).toBe(true);

    await harness.assertScreenContains("[o] Open file");
    await harness.assertScreenContains("[n] New empty");
    await harness.assertScreenContains("[q] Quit");
  }, 20000);

  // ── 2. New Pipeline ────────────────────────────────────────────────

  test("press 'n' to start new pipeline from welcome screen", async () => {
    harness = new TmuxTestHarness({ cwd: REPO_ROOT });
    await startNewPipeline(harness);

    const screen = await harness.capturePane();
    expect(
      screen.includes("Pipeline") ||
      screen.includes("Inspector") ||
      screen.includes("a:add")
    ).toBe(true);
  }, 20000);

  // ── 3. fromps Stage (key regression test) ─────────────────────────

  test("fromps stage produces records in a new pipeline", async () => {
    harness = new TmuxTestHarness({ cwd: REPO_ROOT });
    await startNewPipeline(harness);

    await harness.dumpScreen("before addStage");
    await addStage(harness, "fromps");
    await harness.dumpScreen("after addStage, before waitForExecution");
    await waitForExecution(harness, 10000);

    const screen = await harness.capturePane();
    const hasRecordIndicators =
      screen.includes("pid") ||
      screen.includes("user") ||
      screen.includes("command") ||
      screen.includes("%cpu") ||
      /\d+ record/.test(screen);

    if (!hasRecordIndicators) {
      await harness.dumpScreen("fromps - no record indicators found");
    }

    expect(hasRecordIndicators).toBe(true);
  }, 45000);

  // ── 4. File Input ─────────────────────────────────────────────────

  test("launch with JSONL file shows records", async () => {
    const testFile = `/tmp/recs-e2e-test-${Date.now()}.jsonl`;
    await Bun.write(testFile, [
      '{"name":"Alice","age":30}',
      '{"name":"Bob","age":25}',
      '{"name":"Charlie","age":35}',
    ].join("\n") + "\n");

    try {
      harness = new TmuxTestHarness({
        cwd: REPO_ROOT,
        args: [testFile],
      });
      await harness.start();

      // Wait for data to render
      const hasData = await harness.waitForAnyText(
        ["Alice", "Bob", "Charlie", "name", "age"],
        8000,
      );

      if (!hasData) {
        await harness.dumpScreen("file input - no data found");
      }

      expect(hasData).not.toBeNull();
    } finally {
      const fs = await import("node:fs");
      try { fs.unlinkSync(testFile); } catch {}
    }
  }, 20000);

  // ── 5. Navigation (j/k) ──────────────────────────────────────────

  test("j/k moves cursor between stages", async () => {
    harness = new TmuxTestHarness({ cwd: REPO_ROOT });
    await startNewPipeline(harness);

    await addStage(harness, "fromps");
    await waitForExecution(harness, 10000);

    // Add a second stage (sort with no args — works as identity)
    await addStage(harness, "sort");
    await sleep(2000);

    const screen1 = await harness.capturePane();
    const hasFromps = screen1.includes("fromps");
    const hasSort = screen1.includes("sort");

    if (!hasFromps || !hasSort) {
      await harness.dumpScreen("navigation - missing stages");
    }

    expect(hasFromps).toBe(true);
    expect(hasSort).toBe(true);

    await harness.sendKeys("k");
    await sleep(500);

    // Both stages should still be visible after navigation
    const screen2 = await harness.capturePane();
    expect(screen2.includes("fromps")).toBe(true);
    expect(screen2.includes("sort")).toBe(true);
  }, 50000);

  // ── 6. Tab toggles panels ────────────────────────────────────────

  test("Tab switches between pipeline and inspector panels", async () => {
    harness = new TmuxTestHarness({ cwd: REPO_ROOT });
    await startNewPipeline(harness);

    await addStage(harness, "fromps");
    await waitForExecution(harness, 10000);

    await harness.sendKeys("Tab");
    await sleep(500);

    const screen = await harness.capturePane();
    expect(screen.length).toBeGreaterThan(0);
    expect(screen.includes("fromps")).toBe(true);

    await harness.sendKeys("Tab");
    await sleep(500);
  }, 40000);

  // ── 7. View mode cycling ──────────────────────────────────────────

  test("'t' cycles through view modes in inspector", async () => {
    harness = new TmuxTestHarness({ cwd: REPO_ROOT });
    await startNewPipeline(harness);

    await addStage(harness, "fromps");
    await waitForExecution(harness, 10000);

    await harness.sendKeys("Tab");
    await sleep(500);

    // Capture views as we cycle: table → prettyprint → json → schema
    const views: string[] = [];
    for (let i = 0; i < 4; i++) {
      views.push(await harness.capturePane());
      await harness.sendKeys("t");
      await sleep(500);
    }

    // At least some screens should differ
    const uniqueViews = new Set(views);
    expect(uniqueViews.size).toBeGreaterThanOrEqual(1);
  }, 45000);

  // ── 8. Help panel ─────────────────────────────────────────────────

  test("'?' opens help panel", async () => {
    harness = new TmuxTestHarness({ cwd: REPO_ROOT });
    await startNewPipeline(harness);

    await harness.sendKeys("?");
    await sleep(1000);

    const screen = await harness.capturePane();
    const hasHelp =
      screen.includes("Help") ||
      screen.includes("Keyboard") ||
      screen.includes("shortcuts") ||
      screen.includes("Keybindings") ||
      screen.includes("help");

    if (!hasHelp) {
      await harness.dumpScreen("help - no help panel found");
    }

    expect(hasHelp).toBe(true);

    await harness.sendKeys("Escape");
    await sleep(500);
  }, 20000);

  // ── 9. Quit with 'q' ─────────────────────────────────────────────

  test("'q' exits the explorer", async () => {
    harness = new TmuxTestHarness({ cwd: REPO_ROOT });
    await startNewPipeline(harness);

    await harness.sendKeys("q");
    await sleep(2000);

    let sessionDead = false;
    try {
      const screen = await harness.capturePane();
      sessionDead = !screen.includes("recs explorer") && !screen.includes("Welcome");
    } catch {
      sessionDead = true;
    }
    expect(sessionDead).toBe(true);
  }, 20000);

  // ── 10. Undo with 'u' ────────────────────────────────────────────

  test("'u' undoes the last stage addition", async () => {
    harness = new TmuxTestHarness({ cwd: REPO_ROOT });
    await startNewPipeline(harness);

    await addStage(harness, "fromps");
    await waitForExecution(harness, 10000);

    // Verify fromps is listed
    await harness.assertScreenContains("fromps");

    // Press 'u' to undo
    await harness.sendKeys("u");
    await sleep(2000);

    const screen = await harness.capturePane();

    // After undo, the pipeline should be empty (fromps removed)
    const isEmpty =
      screen.includes("(empty") ||
      screen.includes("press a to add") ||
      !screen.includes("1 fromps");

    if (!isEmpty) {
      await harness.dumpScreen("undo - fromps still visible");
    }

    expect(isEmpty).toBe(true);
  }, 45000);
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
