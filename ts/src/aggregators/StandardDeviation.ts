import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

type Ord2State = [number, number, number]; // [sum1, sumx, sumx2]

export class StandardDeviationAggregator implements Aggregator<Ord2State | null> {
  private field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): Ord2State | null {
    return null;
  }

  combine(state: Ord2State | null, record: Record): Ord2State | null {
    const value = findKey(record.dataRef(), this.field, true);
    if (value === undefined || value === null) return state;
    const x = Number(value);
    const mapped: Ord2State = [1, x, x * x];
    if (state === null) return mapped;
    return [state[0] + mapped[0], state[1] + mapped[1], state[2] + mapped[2]];
  }

  squish(state: Ord2State | null): JsonValue {
    if (state === null) return null;
    const [sum1, sumx, sumx2] = state;
    return Math.sqrt((sumx2 / sum1) - (sumx / sum1) ** 2);
  }
}

aggregatorRegistry.register("stddev", {
  create: (field: string) => new StandardDeviationAggregator(field),
  argCounts: [1],
  shortUsage: "find standard deviation of provided field",
  longUsage: "Usage: stddev,<field1>\n   Standard deviation of specified fields.",
});
