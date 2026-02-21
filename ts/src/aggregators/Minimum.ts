import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class MinimumAggregator implements Aggregator<JsonValue> {
  private field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): JsonValue {
    return null;
  }

  combine(state: JsonValue, record: Record): JsonValue {
    const value = findKey(record.dataRef(), this.field, true);
    if (value === undefined || value === null) return state;
    const num = Number(value);
    if (state === null) return num;
    return (state as number) > num ? num : state;
  }

  squish(state: JsonValue): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("minimum", {
  create: (field: string) => new MinimumAggregator(field),
  argCounts: [1],
  shortUsage: "minimum value for a field",
  longUsage: "Usage: min,<field>\n   Minimum value of specified field.",
  aliases: ["min"],
});
