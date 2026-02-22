import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class LastRecordAggregator implements Aggregator<JsonValue> {
  initial(): JsonValue {
    return null;
  }

  combine(_state: JsonValue, record: Record): JsonValue {
    return record.toJSON();
  }

  squish(state: JsonValue): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("lastrecord", {
  create: () => new LastRecordAggregator(),
  argCounts: [0],
  shortUsage: "last record seen",
  longUsage: "Usage: last_record\n   Last record seen.",
  aliases: ["lastrec"],
});
