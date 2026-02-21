import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class DistinctCountAggregator implements Aggregator<Set<string>> {
  private field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): Set<string> {
    return new Set();
  }

  combine(state: Set<string>, record: Record): Set<string> {
    const value = findKey(record.dataRef(), this.field, true);
    if (value !== undefined && value !== null) {
      state.add(String(value));
    }
    return state;
  }

  squish(state: Set<string>): JsonValue {
    return state.size;
  }
}

aggregatorRegistry.register("dcount", {
  create: (field: string) => new DistinctCountAggregator(field),
  argCounts: [1],
  shortUsage: "count unique values from provided field",
  longUsage: "Usage: dct,<field>\n   Finds the number of unique values for a field and returns it.",
  aliases: ["dct", "distinctcount", "distinctct"],
});
