/**
 * Python snippet runner.
 *
 * Spawns python3 with the Python SDK runner script, communicating
 * via JSONL protocol over stdin/stdout. Uses spawnSync for batch
 * processing to integrate with the synchronous Operation pipeline.
 */

import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Record } from "../Record.ts";
import type { JsonObject } from "../types/json.ts";
import type {
  SnippetRunner,
  SnippetContext,
  SnippetResult,
  SnippetMode,
} from "./SnippetRunner.ts";
import { groupResponses } from "./SnippetRunner.ts";
import { transformCode } from "../Executor.ts";

const SNIPPETS_DIR = dirname(fileURLToPath(import.meta.url));
const RUNNER_DIR = join(SNIPPETS_DIR, "python");
const RUNNER_PATH = join(RUNNER_DIR, "runner.py");

export class PythonSnippetRunner implements SnippetRunner {
  name = "python";
  code = "";
  mode: SnippetMode = "eval";

  async init(code: string, context: SnippetContext): Promise<void> {
    this.code = transformCode(code, "accessor");
    this.mode = context.mode;
  }

  async executeRecord(record: Record): Promise<SnippetResult> {
    const results = this.executeBatch([record]);
    return results[0] ?? { error: "No result from Python runner" };
  }

  executeBatch(records: Record[]): SnippetResult[] {
    const lines: string[] = [
      JSON.stringify({ type: "init", code: this.code, mode: this.mode }),
      ...records.map((r) =>
        JSON.stringify({ type: "record", data: r.toJSON() })
      ),
      JSON.stringify({ type: "done" }),
    ];
    const input = lines.join("\n") + "\n";

    const result = spawnSync("python3", [RUNNER_PATH], {
      input,
      encoding: "utf-8",
      cwd: RUNNER_DIR,
      timeout: 30_000,
    });

    if (result.error) {
      const errno = result.error as NodeJS.ErrnoException;
      if (errno.code === "ENOENT") {
        throw new Error(
          "Python snippet runner requires 'python3' to be installed and on PATH"
        );
      }
      throw new Error(`Failed to spawn python3: ${result.error.message}`);
    }

    if (result.status !== 0 && !result.stdout) {
      throw new Error(
        `Python runner exited with code ${result.status}: ${result.stderr}`
      );
    }

    const responses = result.stdout
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l.trim()) as {
        type: string;
        data?: JsonObject;
        passed?: boolean;
        message?: string;
      });

    // Check for init-level errors (before any records processed)
    if (responses.length > 0 && responses[0]!.type === "error" && records.length > 0) {
      const errorMsg = responses[0]!.message ?? "Unknown error";
      throw new Error(`Python snippet error: ${errorMsg}`);
    }

    return groupResponses(responses);
  }

  async finish(): Promise<void> {
    // no-op for batch model
  }

  async shutdown(): Promise<void> {
    // no-op for batch model
  }
}
