import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue, JsonArray } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class ArrayAggregator implements Aggregator<JsonArray> {
  private field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): JsonArray {
    return [];
  }

  combine(state: JsonArray, record: Record): JsonArray {
    const value = findKey(record.dataRef(), this.field, true);
    if (value !== undefined) {
      state.push(value);
    }
    return state;
  }

  squish(state: JsonArray): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("array", {
  create: (field: string) => new ArrayAggregator(field),
  argCounts: [1],
  shortUsage: "collect values from provided field into an array",
  longUsage: "Usage: array,<field>\n   Collect values from specified field into an array.",
});
