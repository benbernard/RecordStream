import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue, JsonObject } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class PercentileMapAggregator implements Aggregator<number[]> {
  percentiles: number[];
  field: string;

  constructor(percentiles: string, field: string) {
    this.percentiles = percentiles.split(/\s+/).map(Number);
    this.field = field;
  }

  initial(): number[] {
    return [];
  }

  combine(state: number[], record: Record): number[] {
    const value = findKey(record.dataRef(), this.field, true);
    if (value === undefined || value === null) return state;
    state.push(Number(value));
    return state;
  }

  squish(state: number[]): JsonValue {
    if (state.length === 0) return {};
    const sorted = [...state].sort((a, b) => a - b);
    const result: JsonObject = {};
    for (const perc of this.percentiles) {
      let index = Math.floor(sorted.length * (perc / 100));
      if (index === sorted.length) index--;
      result[String(perc)] = sorted[index]!;
    }
    return result;
  }
}

aggregatorRegistry.register("percentilemap", {
  create: (percentiles: string, field: string) => new PercentileMapAggregator(percentiles, field),
  argCounts: [2],
  shortUsage: "map of percentile values for field",
  longUsage: "Usage: percmap,<percentiles>,<field>\n   Finds the field values which <percentiles> percent of values are less than.",
  aliases: ["percmap"],
});
