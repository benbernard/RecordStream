/**
 * TmuxTestHarness — drives the real recs-explorer TUI in a tmux session.
 *
 * Spawns a tmux session with a controlled terminal size, sends keystrokes
 * via `tmux send-keys`, and reads the screen via `tmux capture-pane -p`.
 */

import { nanoid } from "nanoid";

export interface TmuxHarnessOptions {
  /** Extra CLI args passed to `bun run bin/recs.ts explorer ...` */
  args?: string[];
  /** Terminal width (default 120) */
  width?: number;
  /** Terminal height (default 40) */
  height?: number;
  /** Working directory for the explorer process */
  cwd?: string;
}

export class TmuxTestHarness {
  readonly sessionName: string;
  started = false;
  destroyed = false;
  readonly width: number;
  readonly height: number;
  readonly cwd: string;
  readonly args: string[];

  constructor(options: TmuxHarnessOptions = {}) {
    this.sessionName = `recs-e2e-${nanoid(8)}`;
    this.width = options.width ?? 120;
    this.height = options.height ?? 40;
    this.cwd = options.cwd ?? process.cwd();
    this.args = options.args ?? [];
  }

  /** Launch recs-explorer in a tmux session. */
  async start(): Promise<void> {
    if (this.started) throw new Error("Already started");
    this.started = true;

    const cmd = ["bun", "run", "bin/recs.ts", "explorer", ...this.args].join(" ");

    // Create a detached tmux session with controlled size
    await this.exec([
      "tmux", "new-session",
      "-d",
      "-s", this.sessionName,
      "-x", String(this.width),
      "-y", String(this.height),
      cmd,
    ]);

    // Allow time for Bun to compile TypeScript on first run.
    // Subsequent runs benefit from module cache and start much faster.
    await sleep(2500);
  }

  /** Send keystrokes to the tmux pane. */
  async sendKeys(keys: string): Promise<void> {
    this.ensureStarted();
    await this.exec([
      "tmux", "send-keys",
      "-t", this.sessionName,
      keys,
    ]);
    // Brief pause to let the TUI process the input
    await sleep(300);
  }

  /**
   * Send literal text to the tmux pane as a single batch.
   *
   * We send the entire string in one `tmux send-keys -l` command so
   * it arrives in a single DATA chunk. Ink's input parser groups
   * consecutive printable characters into one event, and TextInput's
   * onChange receives the full string at once: `onChange(value + text)`.
   * This avoids the React stale-closure issue where per-character events
   * in the same batch all read the same stale `value`.
   */
  async sendText(text: string): Promise<void> {
    this.ensureStarted();
    await this.exec([
      "tmux", "send-keys",
      "-t", this.sessionName,
      "-l",
      text,
    ]);
    await sleep(500);
  }

  /** Capture the current screen content from the tmux pane. */
  async capturePane(): Promise<string> {
    this.ensureStarted();
    const result = await this.exec([
      "tmux", "capture-pane",
      "-t", this.sessionName,
      "-p",
    ]);
    return result;
  }

  /**
   * Wait until `text` appears on screen.
   * Returns true if found within timeout, false otherwise.
   */
  async waitForText(text: string, timeoutMs = 10000): Promise<boolean> {
    this.ensureStarted();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const screen = await this.capturePane();
      if (screen.includes(text)) return true;
      await sleep(250);
    }
    return false;
  }

  /**
   * Wait until `text` disappears from screen.
   * Returns true if gone within timeout, false otherwise.
   */
  async waitForTextGone(text: string, timeoutMs = 10000): Promise<boolean> {
    this.ensureStarted();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const screen = await this.capturePane();
      if (!screen.includes(text)) return true;
      await sleep(250);
    }
    return false;
  }

  /**
   * Wait until any of the given texts appear on screen.
   * Returns the first matching text, or null on timeout.
   */
  async waitForAnyText(texts: string[], timeoutMs = 10000): Promise<string | null> {
    this.ensureStarted();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const screen = await this.capturePane();
      for (const text of texts) {
        if (screen.includes(text)) return text;
      }
      await sleep(250);
    }
    return null;
  }

  /** Assert that the screen contains the given text. Throws with screen dump on failure. */
  async assertScreenContains(text: string, message?: string): Promise<void> {
    const screen = await this.capturePane();
    if (!screen.includes(text)) {
      throw new Error(
        `${message ?? "Expected screen to contain"}: "${text}"\n\n` +
        `--- Screen content ---\n${screen}\n--- End screen ---`
      );
    }
  }

  /** Assert that the screen does NOT contain the given text. */
  async assertScreenNotContains(text: string, message?: string): Promise<void> {
    const screen = await this.capturePane();
    if (screen.includes(text)) {
      throw new Error(
        `${message ?? "Expected screen NOT to contain"}: "${text}"\n\n` +
        `--- Screen content ---\n${screen}\n--- End screen ---`
      );
    }
  }

  /** Kill the tmux session and clean up. */
  async cleanup(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      await this.exec([
        "tmux", "kill-session",
        "-t", this.sessionName,
      ]);
    } catch {
      // Session may already be gone
    }
  }

  /** Dump the current screen for debugging. */
  async dumpScreen(label?: string): Promise<void> {
    const screen = await this.capturePane();
    const header = label ? `[${label}]` : "[Screen Dump]";
    console.log(`\n${header}\n${"─".repeat(this.width)}\n${screen}\n${"─".repeat(this.width)}\n`);
  }

  ensureStarted(): void {
    if (!this.started) throw new Error("Harness not started. Call start() first.");
    if (this.destroyed) throw new Error("Harness already cleaned up.");
  }

  async exec(cmd: string[]): Promise<string> {
    const proc = Bun.spawn(cmd, {
      cwd: this.cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`Command failed (exit ${exitCode}): ${cmd.join(" ")}\nstderr: ${stderr}`);
    }
    return stdout;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
