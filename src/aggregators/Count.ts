import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class CountAggregator implements Aggregator<JsonValue> {
  initial(): JsonValue {
    return null;
  }

  combine(state: JsonValue, _record: Record): JsonValue {
    if (state === null) return 1;
    return (state as number) + 1;
  }

  squish(state: JsonValue): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("count", {
  create: () => new CountAggregator(),
  argCounts: [0],
  shortUsage: "counts (non-unique) records",
  longUsage: "Usage: count\n   Counts number of (non-unique) records.",
  aliases: ["ct"],
});
