import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

// [sum1, sumx, sumy, sumxy, sumx2, sumy2]
type Ord2BivState = [number, number, number, number, number, number];

export class CovarianceAggregator implements Aggregator<Ord2BivState | null> {
  fieldX: string;
  fieldY: string;

  constructor(fieldX: string, fieldY: string) {
    this.fieldX = fieldX;
    this.fieldY = fieldY;
  }

  initial(): Ord2BivState | null {
    return null;
  }

  combine(state: Ord2BivState | null, record: Record): Ord2BivState | null {
    const vx = findKey(record.dataRef(), this.fieldX, true);
    const vy = findKey(record.dataRef(), this.fieldY, true);
    if (vx === undefined || vx === null || vy === undefined || vy === null) return state;
    const x = Number(vx);
    const y = Number(vy);
    const mapped: Ord2BivState = [1, x, y, x * y, x * x, y * y];
    if (state === null) return mapped;
    return [
      state[0] + mapped[0], state[1] + mapped[1], state[2] + mapped[2],
      state[3] + mapped[3], state[4] + mapped[4], state[5] + mapped[5],
    ];
  }

  squish(state: Ord2BivState | null): JsonValue {
    if (state === null) return null;
    const [sum1, sumx, sumy, sumxy] = state;
    return (sumxy / sum1) - (sumx / sum1) * (sumy / sum1);
  }
}

aggregatorRegistry.register("cov", {
  create: (fieldX: string, fieldY: string) => new CovarianceAggregator(fieldX, fieldY),
  argCounts: [2],
  shortUsage: "find covariance of provided fields",
  longUsage: "Usage: cov,<field1>,<field2>\n   Covariance of specified fields.",
  aliases: ["covar", "covariance"],
});
