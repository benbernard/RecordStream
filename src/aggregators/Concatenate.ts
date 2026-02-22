import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue, JsonArray } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class ConcatenateAggregator implements Aggregator<JsonArray> {
  delimiter: string;
  field: string;

  constructor(delimiter: string, field: string) {
    this.delimiter = delimiter;
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
    return state.map(String).join(this.delimiter);
  }
}

aggregatorRegistry.register("concatenate", {
  create: (delimiter: string, field: string) => new ConcatenateAggregator(delimiter, field),
  argCounts: [2],
  shortUsage: "concatenate values from provided field",
  longUsage: "Usage: concat,<delimiter>,<field>\n   Concatenate values from specified field.",
  aliases: ["concat"],
});
