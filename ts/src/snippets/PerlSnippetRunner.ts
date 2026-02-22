/**
 * Perl snippet runner.
 *
 * Spawns perl with the Perl SDK runner script, communicating via JSONL
 * protocol over stdin/stdout. Same batch model as PythonSnippetRunner.
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

const SNIPPETS_DIR = dirname(fileURLToPath(import.meta.url));
const RUNNER_DIR = join(SNIPPETS_DIR, "perl");
const RUNNER_PATH = join(RUNNER_DIR, "runner.pl");

export class PerlSnippetRunner implements SnippetRunner {
  name = "perl";
  #code = "";
  #mode: SnippetMode = "eval";

  async init(code: string, context: SnippetContext): Promise<void> {
    this.#code = code;
    this.#mode = context.mode;
  }

  async executeRecord(record: Record): Promise<SnippetResult> {
    const results = this.executeBatch([record]);
    return results[0] ?? { error: "No result from Perl runner" };
  }

  executeBatch(records: Record[]): SnippetResult[] {
    const lines: string[] = [
      JSON.stringify({ type: "init", code: this.#code, mode: this.#mode }),
      ...records.map((r) =>
        JSON.stringify({ type: "record", data: r.toJSON() })
      ),
      JSON.stringify({ type: "done" }),
    ];
    const input = lines.join("\n") + "\n";

    const result = spawnSync("perl", [RUNNER_PATH], {
      input,
      encoding: "utf-8",
      timeout: 30_000,
    });

    if (result.error) {
      const errno = result.error as NodeJS.ErrnoException;
      if (errno.code === "ENOENT") {
        throw new Error(
          "Perl snippet runner requires 'perl' to be installed and on PATH"
        );
      }
      throw new Error(`Failed to spawn perl: ${result.error.message}`);
    }

    if (result.status !== 0 && !result.stdout) {
      throw new Error(
        `Perl runner exited with code ${result.status}: ${result.stderr}`
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
      throw new Error(`Perl snippet error: ${errorMsg}`);
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
