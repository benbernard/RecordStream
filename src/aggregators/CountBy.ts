import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue, JsonObject } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class CountByAggregator implements Aggregator<JsonObject> {
  field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): JsonObject {
    return {};
  }

  combine(state: JsonObject, record: Record): JsonObject {
    const value = findKey(record.dataRef(), this.field, true);
    if (value !== undefined && value !== null) {
      const key = String(value);
      state[key] = ((state[key] as number) || 0) + 1;
    }
    return state;
  }

  squish(state: JsonObject): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("countby", {
  create: (field: string) => new CountByAggregator(field),
  argCounts: [1],
  shortUsage: "counts by unique value for a field",
  longUsage: "Usage: cb,<field>\n  Returns a list of uniq values associated with their counts.",
  aliases: ["cb"],
});
