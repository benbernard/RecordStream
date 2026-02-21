import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue, JsonArray } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class UniqArrayAggregator implements Aggregator<Set<string>> {
  private field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): Set<string> {
    return new Set();
  }

  combine(state: Set<string>, record: Record): Set<string> {
    const value = findKey(record.dataRef(), this.field, true);
    if (value !== undefined && value !== null) {
      state.add(String(value));
    }
    return state;
  }

  squish(state: Set<string>): JsonValue {
    const arr: JsonArray = [...state].sort();
    return arr;
  }
}

aggregatorRegistry.register("uarray", {
  create: (field: string) => new UniqArrayAggregator(field),
  argCounts: [1],
  shortUsage: "collect unique values from provided field into an array",
  longUsage: "Usage: uarray,<field>\n   Collect unique values from specified field into an array.",
});
