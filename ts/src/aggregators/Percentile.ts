import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class PercentileAggregator implements Aggregator<number[]> {
  private percentile: number;
  private field: string;

  constructor(percentile: string, field: string) {
    this.percentile = Number(percentile);
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
    if (state.length === 0) return null;
    const sorted = [...state].sort((a, b) => a - b);
    let index = Math.floor(sorted.length * (this.percentile / 100));
    if (index === sorted.length) index--;
    return sorted[index]!;
  }
}

aggregatorRegistry.register("percentile", {
  create: (percentile: string, field: string) => new PercentileAggregator(percentile, field),
  argCounts: [2],
  shortUsage: "value of pXX for field",
  longUsage: "Usage: per,<percentile>,<field>\n   Finds the field value which <percentile> percent of values are less than.",
  aliases: ["perc"],
});
