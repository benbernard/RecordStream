import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue, JsonArray } from "../types/json.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class RecordsAggregator implements Aggregator<JsonArray> {
  initial(): JsonArray {
    return [];
  }

  combine(state: JsonArray, record: Record): JsonArray {
    state.push(record.toJSON());
    return state;
  }

  squish(state: JsonArray): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("records", {
  create: () => new RecordsAggregator(),
  argCounts: [0],
  shortUsage: "returns an arrayref of all records",
  longUsage: "Usage: records\n   An arrayref of all records.",
  aliases: ["recs"],
});
