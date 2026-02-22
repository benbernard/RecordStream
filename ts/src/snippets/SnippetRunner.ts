/**
 * SnippetRunner abstraction for executing code snippets in multiple languages.
 *
 * All snippet execution (JS, Python, Perl) goes through this interface,
 * allowing operations to support --lang flag for multi-language snippets.
 */

import type { JsonObject } from "../types/json.ts";
import type { Record } from "../Record.ts";

export type SnippetMode = "eval" | "grep" | "xform" | "generate";

export interface SnippetContext {
  mode: SnippetMode;
}

export interface SnippetResult {
  record?: JsonObject;
  records?: JsonObject[];
  passed?: boolean;
  error?: string;
}

export interface SnippetRunner {
  name: string;
  init(code: string, context: SnippetContext): Promise<void>;
  executeRecord(record: Record): Promise<SnippetResult>;
  executeBatch(records: Record[]): SnippetResult[];
  finish(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Check whether a language string refers to JavaScript/TypeScript.
 */
export function isJsLang(lang: string): boolean {
  return ["js", "javascript", "ts", "typescript"].includes(lang.toLowerCase());
}

/**
 * Parse JSONL responses from a subprocess runner, grouping them by
 * record_done delimiters into per-record SnippetResults.
 */
export function groupResponses(
  responses: { type: string; data?: JsonObject; passed?: boolean; message?: string }[]
): SnippetResult[] {
  const results: SnippetResult[] = [];
  let current: SnippetResult = {};
  let emitted: JsonObject[] = [];

  for (const msg of responses) {
    switch (msg.type) {
      case "result":
        current.record = msg.data;
        break;
      case "filter":
        current.passed = msg.passed;
        break;
      case "emit":
        if (msg.data) emitted.push(msg.data);
        break;
      case "error":
        current.error = msg.message;
        break;
      case "record_done":
        if (emitted.length > 0) {
          current.records = emitted;
          emitted = [];
        }
        results.push(current);
        current = {};
        break;
    }
  }

  return results;
}
