import type { AnyAggregator } from "./Aggregator.ts";
import { aggregatorRegistry } from "./Aggregator.ts";
import type { Record } from "./Record.ts";
import type { JsonValue } from "./types/json.ts";
import { findKey } from "./KeySpec.ts";

/**
 * DomainLanguage provides a programmatic way to create aggregators and
 * valuations using JavaScript expressions. This is the TS equivalent of
 * the Perl DomainLanguage system, adapted for JS/TS semantics.
 *
 * Instead of Perl snippets, we use JavaScript function strings that are
 * compiled with `new Function()`.
 *
 * Analogous to App::RecordStream::DomainLanguage in Perl.
 */

/** A Valuation extracts a value from a record */
export interface Valuation {
  evaluateRecord(record: Record): JsonValue;
}

/** A valuation that extracts a field value via KeySpec */
export class KeySpecValuation implements Valuation {
  #field: string;
  constructor(field: string) {
    this.#field = field;
  }
  evaluateRecord(record: Record): JsonValue {
    const v = findKey(record.dataRef(), this.#field, true);
    return v === undefined ? null : v;
  }
}

/** A valuation that returns the whole record as JSON */
export class RecordValuation implements Valuation {
  evaluateRecord(record: Record): JsonValue {
    return record.toJSON();
  }
}

/** A valuation from a JS function */
export class FunctionValuation implements Valuation {
  #fn: (r: Record) => JsonValue;
  constructor(fn: (r: Record) => JsonValue) {
    this.#fn = fn;
  }
  evaluateRecord(record: Record): JsonValue {
    return this.#fn(record);
  }
}

/**
 * Create an aggregator from a snippet expression.
 * Snippet syntax: {{field}} is replaced with field access on the record.
 */
export function compileSnippet(
  code: string,
  vars: { [key: string]: JsonValue } = {}
): (r: import("./Record.ts").Record) => JsonValue {
  // Replace {{field}} with record field access
  const transformed = code.replace(
    /\{\{([^}]+)\}\}/g,
    (_match, field: string) => `__findKey(__r.dataRef(), ${JSON.stringify(field)}, true)`
  );

  const varNames = Object.keys(vars);
  const varValues = Object.values(vars);

  // eslint-disable-next-line no-restricted-syntax -- DomainLanguage requires dynamic code evaluation
  const fn = new Function(
    "__findKey",
    "__r",
    ...varNames,
    `return (${transformed});`
  );

  return (r: import("./Record.ts").Record) =>
    fn(findKey, r, ...varValues) as JsonValue;
}

/**
 * Create a snippet-based valuation.
 */
export function snippetValuation(code: string): Valuation {
  const fn = compileSnippet(code);
  return new FunctionValuation(fn);
}

/**
 * InjectInto aggregator from snippet functions.
 *
 * Usage: ii_agg(initialExpr, combineExpr, [squishExpr])
 *   - initialExpr: JS expression returning initial accumulator value
 *   - combineExpr: JS expression using $a (accumulator) and $r (record)
 *   - squishExpr: Optional JS expression using $a (final accumulator)
 */
export function injectIntoAgg(
  initialExpr: string,
  combineExpr: string,
  squishExpr?: string
): AnyAggregator {
  const initialFn = compileSnippet(initialExpr);
  const combineFn = new Function(
    "__findKey",
    "$a",
    "$r",
    `return (${combineExpr.replace(
      /\{\{([^}]+)\}\}/g,
      (_m, f: string) => `__findKey($r.dataRef(), ${JSON.stringify(f)}, true)`
    )});`
  );
  const squishFn = squishExpr
    ? new Function("$a", `return (${squishExpr});`)
    : null;

  return {
    initial(): unknown {
      return initialFn({ dataRef: () => ({}) } as import("./Record.ts").Record);
    },
    combine(state: unknown, record: import("./Record.ts").Record): unknown {
      return combineFn(findKey, state, record) as unknown;
    },
    squish(state: unknown): JsonValue {
      if (squishFn) return squishFn(state) as JsonValue;
      return state as JsonValue;
    },
  };
}

/**
 * MapReduce aggregator from snippet functions.
 *
 * Usage: mr_agg(mapExpr, reduceExpr, [squishExpr])
 *   - mapExpr: JS expression using $r (record)
 *   - reduceExpr: JS expression using $a and $b
 *   - squishExpr: Optional JS expression using $a
 */
export function mapReduceAgg(
  mapExpr: string,
  reduceExpr: string,
  squishExpr?: string
): AnyAggregator {
  const mapFn = new Function(
    "__findKey",
    "$r",
    `return (${mapExpr.replace(
      /\{\{([^}]+)\}\}/g,
      (_m, f: string) => `__findKey($r.dataRef(), ${JSON.stringify(f)}, true)`
    )});`
  );
  const reduceFn = new Function("$a", "$b", `return (${reduceExpr});`);
  const squishFn = squishExpr
    ? new Function("$a", `return (${squishExpr});`)
    : null;

  return {
    initial(): unknown {
      return undefined;
    },
    combine(state: unknown, record: import("./Record.ts").Record): unknown {
      const mapped = mapFn(findKey, record) as unknown;
      if (state === undefined) return mapped;
      if (mapped === undefined) return state;
      return reduceFn(state, mapped) as unknown;
    },
    squish(state: unknown): JsonValue {
      if (squishFn) return squishFn(state) as JsonValue;
      return state as JsonValue;
    },
  };
}

/**
 * Subset aggregator: filter records through a predicate before aggregating.
 */
export function subsetAgg(
  predicateExpr: string,
  innerAgg: AnyAggregator
): AnyAggregator {
  const predFn = new Function(
    "__findKey",
    "$r",
    `return !!(${predicateExpr.replace(
      /\{\{([^}]+)\}\}/g,
      (_m, f: string) => `__findKey($r.dataRef(), ${JSON.stringify(f)}, true)`
    )});`
  );

  return {
    initial(): unknown {
      return innerAgg.initial();
    },
    combine(state: unknown, record: import("./Record.ts").Record): unknown {
      if (predFn(findKey, record)) {
        return innerAgg.combine(state, record);
      }
      return state;
    },
    squish(state: unknown): JsonValue {
      return innerAgg.squish(state);
    },
  };
}

/**
 * Transform aggregator: apply a transform to an aggregator's result.
 */
export function xformAgg(
  innerAgg: AnyAggregator,
  transformExpr: string
): AnyAggregator {
  const xformFn = new Function(
    "__findKey",
    "$a",
    `return (${transformExpr.replace(
      /\{\{([^}]+)\}\}/g,
      (_m, f: string) => {
        // Support {{N/field}} for indexed record access
        return `__findKey($a, ${JSON.stringify(f)}, true)`;
      }
    )});`
  );

  return {
    initial(): unknown {
      return innerAgg.initial();
    },
    combine(state: unknown, record: import("./Record.ts").Record): unknown {
      return innerAgg.combine(state, record);
    },
    squish(state: unknown): JsonValue {
      const result = innerAgg.squish(state);
      return xformFn(findKey, result) as JsonValue;
    },
  };
}

/**
 * Parse a domain language expression string and produce an aggregator.
 * This is the main entry point for --dla/-e style aggregator definitions.
 *
 * The expression is JavaScript code that has access to helper functions
 * for creating aggregators.
 */
export function parseDomainLanguage(expr: string): AnyAggregator {
  // Build the evaluation context with all helper functions
  const context: { [key: string]: unknown } = {
    // Special constructors
    ii_agg: injectIntoAgg,
    ii_aggregator: injectIntoAgg,
    inject_into_agg: injectIntoAgg,
    inject_into_aggregator: injectIntoAgg,
    mr_agg: mapReduceAgg,
    mr_aggregator: mapReduceAgg,
    map_reduce_agg: mapReduceAgg,
    map_reduce_aggregator: mapReduceAgg,
    subset_agg: subsetAgg,
    subset_aggregator: subsetAgg,
    xform: xformAgg,
    snip: snippetValuation,
    rec: () => new RecordValuation(),
    record: () => new RecordValuation(),
    val: (fn: (r: import("./Record.ts").Record) => JsonValue) => new FunctionValuation(fn),
    valuation: (fn: (r: import("./Record.ts").Record) => JsonValue) => new FunctionValuation(fn),
  };

  // Add aggregator constructors from registry
  for (const name of aggregatorRegistry.names()) {
    context[name] = (...args: string[]) => aggregatorRegistry.parse([name, ...args].join(","));
  }

  // Filter out names that are JS reserved words (like "var") or invalid identifiers.
  // Only pass safe identifiers as function parameters.
  const safeEntries: [string, unknown][] = [];
  for (const [key, value] of Object.entries(context)) {
    if (!JS_RESERVED.has(key) && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
      safeEntries.push([key, value]);
    }
    // Also register with underscore prefix for reserved words (like _var)
    if (JS_RESERVED.has(key)) {
      safeEntries.push([`_${key}`, value]);
    }
  }

  const paramNames = safeEntries.map(([k]) => k);
  const paramValues = safeEntries.map(([, v]) => v);

  // eslint-disable-next-line no-restricted-syntax -- DomainLanguage requires dynamic code evaluation
  const fn = new Function(...paramNames, `return (${expr});`);
  return fn(...paramValues) as AnyAggregator;
}

// JS reserved words that can't be used as variable names
const JS_RESERVED = new Set([
  "break", "case", "catch", "continue", "debugger", "default", "delete",
  "do", "else", "finally", "for", "function", "if", "in", "instanceof",
  "new", "return", "switch", "this", "throw", "try", "typeof", "var",
  "void", "while", "with", "class", "const", "enum", "export", "extends",
  "import", "super", "implements", "interface", "let", "package", "private",
  "protected", "public", "static", "yield",
]);

