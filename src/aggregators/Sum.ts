import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class SumAggregator implements Aggregator<JsonValue> {
  field: string;

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
    return (state as number) + num;
  }

  squish(state: JsonValue): JsonValue {
    return state;
  }
}

aggregatorRegistry.register("sum", {
  create: (field: string) => new SumAggregator(field),
  argCounts: [1],
  shortUsage: "sums provided field",
  longUsage: "Usage: sum,<field>\n   Sums specified field.",
});
