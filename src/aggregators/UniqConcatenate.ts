import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class UniqConcatenateAggregator implements Aggregator<Set<string>> {
  delimiter: string;
  field: string;

  constructor(delimiter: string, field: string) {
    this.delimiter = delimiter;
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
    return [...state].sort().join(this.delimiter);
  }
}

aggregatorRegistry.register("uconcatenate", {
  create: (delimiter: string, field: string) => new UniqConcatenateAggregator(delimiter, field),
  argCounts: [2],
  shortUsage: "concatenate unique values from provided field",
  longUsage: "Usage: uconcat,<delimiter>,<field>\n   Concatenate unique values from specified field.",
  aliases: ["uconcat"],
});
