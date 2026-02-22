/**
 * Snippet runner factory and re-exports.
 */

export type {
  SnippetRunner,
  SnippetContext,
  SnippetResult,
  SnippetMode,
} from "./SnippetRunner.ts";
export { isJsLang, groupResponses } from "./SnippetRunner.ts";
export { JsSnippetRunner } from "./JsSnippetRunner.ts";
export { PythonSnippetRunner } from "./PythonSnippetRunner.ts";
export { PerlSnippetRunner } from "./PerlSnippetRunner.ts";

import type { SnippetRunner } from "./SnippetRunner.ts";
import { JsSnippetRunner } from "./JsSnippetRunner.ts";
import { PythonSnippetRunner } from "./PythonSnippetRunner.ts";
import { PerlSnippetRunner } from "./PerlSnippetRunner.ts";
import type { OptionDef } from "../Operation.ts";

/**
 * Create a snippet runner for the given language.
 */
export function createSnippetRunner(lang: string): SnippetRunner {
  switch (lang.toLowerCase()) {
    case "js":
    case "javascript":
    case "ts":
    case "typescript":
      return new JsSnippetRunner();
    case "python":
    case "py":
      return new PythonSnippetRunner();
    case "perl":
    case "pl":
      return new PerlSnippetRunner();
    default:
      throw new Error(`Unknown snippet language: ${lang}`);
  }
}

/**
 * Create a standard --lang option def for operations that support
 * multi-language snippets.
 */
export function langOptionDef(
  handler: (lang: string) => void,
): OptionDef {
  return {
    long: "lang",
    short: "l",
    type: "string",
    handler: (v) => { handler(v as string); },
    description:
      "Snippet language: js (default), python/py, perl/pl",
  };
}
