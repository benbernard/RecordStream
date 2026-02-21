import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class ModeAggregator implements Aggregator<Map<string, number>> {
  private field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): Map<string, number> {
    return new Map();
  }

  combine(state: Map<string, number>, record: Record): Map<string, number> {
    const value = findKey(record.dataRef(), this.field, true);
    if (value === undefined || value === null) return state;
    const key = String(value);
    state.set(key, (state.get(key) ?? 0) + 1);
    return state;
  }

  squish(state: Map<string, number>): JsonValue {
    if (state.size === 0) return null;
    let maxKey = "";
    let maxValue = -1;
    for (const [key, value] of state) {
      if (value > maxValue) {
        maxKey = key;
        maxValue = value;
      }
    }
    return maxKey;
  }
}

aggregatorRegistry.register("mode", {
  create: (field: string) => new ModeAggregator(field),
  argCounts: [1],
  shortUsage: "most common value for a field",
  longUsage: "Usage: mode,<field>\n   Finds the most common value for a field and returns it.",
});
