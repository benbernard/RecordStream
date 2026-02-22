import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class FirstRecordAggregator implements Aggregator<JsonValue> {
  initial(): JsonValue {
    return null;
  }

  combine(state: JsonValue, record: Record): JsonValue {
    if (state !== null) return state;
    return record.toJSON();
  }

  squish(state: JsonValue): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("firstrecord", {
  create: () => new FirstRecordAggregator(),
  argCounts: [0],
  shortUsage: "first record",
  longUsage: "Usage: first\n   Returns the first record.",
  aliases: ["firstrec"],
});
