/**
 * JavaScript/TypeScript snippet runner.
 *
 * Wraps the existing Executor class to provide the SnippetRunner interface.
 * All execution is synchronous (in-process via new Function()).
 */

import { Executor, autoReturn } from "../Executor.ts";
import { Record } from "../Record.ts";
import type { JsonObject } from "../types/json.ts";
import type {
  SnippetRunner,
  SnippetContext,
  SnippetResult,
  SnippetMode,
} from "./SnippetRunner.ts";

export class JsSnippetRunner implements SnippetRunner {
  name = "javascript";
  #executor: Executor | null = null;
  #mode: SnippetMode = "eval";

  async init(code: string, context: SnippetContext): Promise<void> {
    this.#mode = context.mode;

    switch (context.mode) {
      case "eval":
        // Eval mode: run code, return modified record
        this.#executor = new Executor(`${code}\n; return r;`);
        break;
      case "grep":
        // Grep mode: evaluate as expression, return boolean
        this.#executor = new Executor(autoReturn(code));
        break;
      case "xform":
        // Xform mode: run code, return modified record (or array)
        this.#executor = new Executor(`${code}\n; return r;`);
        break;
      case "generate":
        // Generate mode: evaluate expression, return array of records
        this.#executor = new Executor(autoReturn(code));
        break;
    }
  }

  async executeRecord(record: Record): Promise<SnippetResult> {
    return this.#executeRecordSync(record);
  }

  executeBatch(records: Record[]): SnippetResult[] {
    return records.map((r) => this.#executeRecordSync(r));
  }

  #executeRecordSync(record: Record): SnippetResult {
    if (!this.#executor) {
      return { error: "Runner not initialized" };
    }

    try {
      switch (this.#mode) {
        case "eval": {
          this.#executor.executeCode(record);
          return { record: record.toJSON() };
        }
        case "grep": {
          const result = this.#executor.executeCode(record);
          return { passed: !!result };
        }
        case "xform": {
          const result = this.#executor.executeCode(record);
          if (Array.isArray(result)) {
            const records = result
              .filter((item): item is JsonObject | Record =>
                typeof item === "object" && item !== null
              )
              .map((item) =>
                item instanceof Record ? item.toJSON() : (item as JsonObject)
              );
            return { records };
          }
          if (result instanceof Record) {
            return { records: [result.toJSON()] };
          }
          if (typeof result === "object" && result !== null) {
            return { records: [result as JsonObject] };
          }
          return { records: [record.toJSON()] };
        }
        case "generate": {
          const result = this.#executor.executeCode(record);
          const items = Array.isArray(result) ? result : result ? [result] : [];
          const records = items
            .filter((item): item is JsonObject | Record =>
              typeof item === "object" && item !== null
            )
            .map((item) =>
              item instanceof Record ? item.toJSON() : (item as JsonObject)
            );
          return { records };
        }
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  async finish(): Promise<void> {
    // no-op for JS runner
  }

  async shutdown(): Promise<void> {
    this.#executor = null;
  }
}
