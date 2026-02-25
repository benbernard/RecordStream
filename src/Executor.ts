import { readFileSync } from "node:fs";
import type { Record as RsRecord } from "./Record.ts";
import { findKey, setKey } from "./KeySpec.ts";
import type { JsonValue, JsonObject } from "./types/json.ts";
import type { OptionDef } from "./Operation.ts";

/**
 * Executor handles compilation and execution of user code snippets.
 * It transforms {{keyspec}} syntax into key lookups and creates
 * sandboxed functions for evaluation.
 *
 * Analogous to App::RecordStream::Executor in Perl.
 */

export interface SnippetDef {
  code: string;
  argNames?: string[];
}

export class Executor {
  snippets: Map<string, CompiledSnippet>;
  lineCounter = 0;
  currentFilename = "NONE";
  state: Record<string, unknown> = {};

  constructor(codeOrSnippets: string | { [name: string]: SnippetDef }) {
    this.snippets = new Map();

    if (typeof codeOrSnippets === "string") {
      this.addSnippet("__DEFAULT", {
        code: codeOrSnippets,
        argNames: ["r"],
      });
    } else {
      for (const [name, def] of Object.entries(codeOrSnippets)) {
        this.addSnippet(name, def);
      }
    }
  }

  addSnippet(name: string, def: SnippetDef): void {
    const transformedCode = transformCode(def.code);
    const argNames = def.argNames ?? ["r"];
    const fn = compileSnippet(transformedCode, argNames, this.state);
    this.snippets.set(name, { fn, argNames });
  }

  /**
   * Execute the default snippet with the given record.
   * Returns the result of the snippet execution.
   */
  executeCode(record: RsRecord): unknown {
    return this.executeMethod("__DEFAULT", record);
  }

  /**
   * Execute a named snippet with the given arguments.
   */
  executeMethod(name: string, ...args: unknown[]): unknown {
    const snippet = this.snippets.get(name);
    if (!snippet) {
      throw new Error(`No such snippet: ${name}`);
    }

    this.lineCounter++;
    return snippet.fn(...args, this.lineCounter, this.currentFilename);
  }

  setCurrentFilename(filename: string): void {
    this.currentFilename = filename;
  }

  getCurrentFilename(): string {
    return this.currentFilename;
  }

  getLine(): number {
    return this.lineCounter;
  }

  resetLine(): void {
    this.lineCounter = 0;
  }
}

interface CompiledSnippet {
  fn: (...args: unknown[]) => unknown;
  argNames: string[];
}

/**
 * Transform {{keyspec}} syntax into accessor expressions.
 *
 * Uses a language-native lvalue approach: the expansion produces an expression
 * that can appear on both the left and right side of assignments. This means
 * the language itself handles reads, writes, compound assignments (+=, *=, etc.),
 * and even increment/decrement — no regex-based assignment detection needed.
 *
 * For JS/Python ("accessor" style): {{foo/bar}} becomes __F["foo/bar"]
 *   where __F is a Proxy (JS) or __getitem__/__setitem__ object (Python).
 *
 * For Perl ("lvalue" style): {{foo/bar}} becomes _f("foo/bar")
 *   where _f is a Perl lvalue sub that returns a modifiable hash element.
 */
export function transformCode(code: string, style: "accessor" | "lvalue" = "accessor"): string {
  return code.replace(
    /\{\{(.*?)\}\}/g,
    (_match, keyspec: string) => {
      const ks = JSON.stringify(keyspec);
      if (style === "lvalue") {
        return `_f(${ks})`;
      }
      return `__F[${ks}]`;
    }
  );
}

/**
 * Wrap a user expression so that it returns its result.
 * In Perl, eval returns the last expression automatically; JS requires explicit return.
 * If the code already contains 'return', it is left as-is.
 * For multi-statement code (separated by ;), only the last statement is wrapped.
 */
export function autoReturn(code: string): string {
  const trimmed = code.trim();
  if (/\breturn\b/.test(trimmed)) return trimmed;

  // Strip trailing semicolons
  const stripped = trimmed.replace(/;+$/, "");
  if (stripped.includes(";")) {
    const lastSemi = stripped.lastIndexOf(";");
    const prefix = stripped.substring(0, lastSemi + 1);
    const lastExpr = stripped.substring(lastSemi + 1).trim();
    if (lastExpr) {
      return `${prefix}\nreturn (${lastExpr})`;
    }
    return stripped;
  }

  return `return (${stripped})`;
}

/**
 * Compile a code snippet into a callable function.
 * The function receives the user-specified arguments plus $line and $filename.
 * A shared state object is captured in the closure so that user-assigned
 * variables on `state` persist across invocations (analogous to Perl's
 * persistent lexical scope across eval calls).
 */
function compileSnippet(
  code: string,
  argNames: string[],
  state: Record<string, unknown>,
): (...args: unknown[]) => unknown {
  // Build argument list: user args + line + filename
  const allArgNames = [...argNames, "$line", "$filename"];

  // __F is a Proxy that makes {{keyspec}} expansions work as native lvalues.
  // {{x}} expands to __F["x"], and the Proxy's get/set traps handle
  // KeySpec resolution. This means reads, writes, compound assignments (+=),
  // increment (++), etc. all work without any assignment-detection regex.
  //
  // Only created when the transformed code actually uses __F (i.e. the
  // original code contained {{}} templates). Snippets without templates
  // (e.g. named snippets with custom args) skip this entirely.
  const needsProxy = code.includes("__F[");
  const helperCode = needsProxy
    ? `
    const __data = typeof r === 'object' && r !== null && 'dataRef' in r ? r.dataRef() : r;
    const __F = new Proxy(Object.create(null), {
      get(_, prop) {
        if (typeof prop === 'string') return __findKey(__data, '@' + prop);
        return undefined;
      },
      set(_, prop, value) {
        if (typeof prop === 'string') __setKey(__data, '@' + prop, value);
        return true;
      },
    });
  `
    : "";

  const fnBody = `
    ${helperCode}
    ${code}
  `;

  try {
    // Create a function with the helper functions and shared state in closure
    const factory = new Function(
      "__findKey",
      "__setKey",
      "Proxy",
      "state",
      `return function(${allArgNames.join(", ")}) { ${fnBody} }`
    );
    return factory(
      (data: JsonObject, spec: string) => findKey(data, spec),
      (data: JsonObject, spec: string, value: JsonValue) =>
        setKey(data, spec, value),
      Proxy,
      state,
    );
  } catch (e) {
    throw new Error(
      `Failed to compile code snippet: ${e instanceof Error ? e.message : String(e)}\nCode: ${code}`
    );
  }
}

/**
 * Create a standard -E option def for reading snippet code from a file.
 * The callback receives the file contents when -E is used.
 */
export function snippetFromFileOption(
  onSnippet: (code: string) => void
): OptionDef {
  return {
    long: "snippet-file",
    short: "E",
    type: "string",
    handler: (v) => {
      const filePath = v as string;
      const code = readFileSync(filePath, "utf-8");
      onSnippet(code);
    },
    description: "Read snippet code from a file instead of the command line",
  };
}
