import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue, JsonObject, JsonArray } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

// State: [value, record_data] or null
type RecForState = JsonArray | null;

export class RecordForMaximumAggregator implements Aggregator<RecForState> {
  field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): RecForState {
    return null;
  }

  combine(state: RecForState, record: Record): RecForState {
    const value = findKey(record.dataRef(), this.field, true);
    if (value === undefined || value === null) return state;
    const num = Number(value);
    const mapped: JsonArray = [num, record.toJSON()];
    if (state === null) return mapped;
    if ((state[0] as number) > num) return state;
    return mapped;
  }

  squish(state: RecForState): JsonValue {
    if (state === null) return null;
    return state[1] as JsonObject;
  }
}

aggregatorRegistry.register("recformax", {
  create: (field: string) => new RecordForMaximumAggregator(field),
  argCounts: [1],
  shortUsage: "returns the record corresponding to the maximum value for a field",
  longUsage: "Usage: recformax,<field>\n   The record corresponding to the maximum value of specified field.",
  aliases: ["recformaximum", "recordformax", "recordformaximum"],
});
