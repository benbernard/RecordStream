import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class FirstAggregator implements Aggregator<JsonValue> {
  private field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): JsonValue {
    return null;
  }

  combine(state: JsonValue, record: Record): JsonValue {
    if (state !== null) return state;
    const value = findKey(record.dataRef(), this.field, true);
    if (value === undefined) return state;
    return value;
  }

  squish(state: JsonValue): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("first", {
  create: (field: string) => new FirstAggregator(field),
  argCounts: [1],
  shortUsage: "first value for a field",
  longUsage: "Usage: first,<field>\n   First value of specified field.",
});
