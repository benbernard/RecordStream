import type { Record } from "./Record.ts";
import type { JsonValue } from "./types/json.ts";
import { BaseRegistry } from "./BaseRegistry.ts";

/**
 * Base interface for all aggregators.
 *
 * Aggregators follow the initial/combine/squish pattern:
 * 1. initial() - create initial state (cookie)
 * 2. combine(cookie, record) - fold a record into the state
 * 3. squish(cookie) - produce the final aggregated value
 *
 * Analogous to App::RecordStream::Aggregator in Perl.
 */
export interface Aggregator<TState = unknown> {
  /** Create initial accumulator state */
  initial(): TState;
  /** Combine a record into the accumulator state */
  combine(state: TState, record: Record): TState;
  /** Produce the final value from the accumulated state */
  squish(state: TState): JsonValue;
}

/**
 * Type-erased aggregator for use in maps.
 */
export type AnyAggregator = Aggregator<unknown>;

/**
 * The global aggregator registry.
 */
export const aggregatorRegistry = new BaseRegistry<AnyAggregator>("aggregator");

/**
 * Parse aggregator specs of the form "name=type,arg1,arg2" and return
 * a map of name -> aggregator.
 */
export function makeAggregators(
  ...specs: string[]
): Map<string, AnyAggregator> {
  const result = new Map<string, AnyAggregator>();

  for (const input of specs) {
    let spec = input;
    let name: string | undefined;

    // Split on first = for name=spec format
    const eqIndex = spec.indexOf("=");
    if (eqIndex >= 0) {
      name = spec.slice(0, eqIndex);
      spec = spec.slice(eqIndex + 1);
    }

    // Auto-generate name from spec if not provided
    if (!name) {
      const parts = spec.split(",");
      name = parts.join("_").replace(/\//g, "_");
    }

    result.set(name, aggregatorRegistry.parse(spec));
  }

  return result;
}

/**
 * Initialize all aggregators - create a map of name -> initial state.
 */
export function mapInitial(
  aggrs: Map<string, AnyAggregator>
): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const [name, aggr] of aggrs) {
    result.set(name, aggr.initial());
  }
  return result;
}

/**
 * Combine a record into all aggregator states.
 */
export function mapCombine(
  aggrs: Map<string, AnyAggregator>,
  cookies: Map<string, unknown>,
  record: Record
): Map<string, unknown> {
  const result = new Map<string, unknown>();
  for (const [name, aggr] of aggrs) {
    result.set(name, aggr.combine(cookies.get(name), record));
  }
  return result;
}

/**
 * Squish all aggregator states into final values.
 * Returns a map of name -> final value.
 */
export function mapSquish(
  aggrs: Map<string, AnyAggregator>,
  cookies: Map<string, unknown>
): Map<string, JsonValue> {
  const result = new Map<string, JsonValue>();
  for (const [name, aggr] of aggrs) {
    result.set(name, aggr.squish(cookies.get(name)));
  }
  return result;
}
