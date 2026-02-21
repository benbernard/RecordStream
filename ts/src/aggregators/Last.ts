import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class LastAggregator implements Aggregator<JsonValue> {
  field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): JsonValue {
    return null;
  }

  combine(_state: JsonValue, record: Record): JsonValue {
    const value = findKey(record.dataRef(), this.field, true);
    if (value === undefined) return null;
    return value;
  }

  squish(state: JsonValue): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("last", {
  create: (field: string) => new LastAggregator(field),
  argCounts: [1],
  shortUsage: "last value for a field",
  longUsage: "Usage: last,<field>\n   Last value of specified field.",
});
