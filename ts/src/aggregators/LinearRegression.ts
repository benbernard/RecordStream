import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

// [sum1, sumx, sumy, sumxy, sumx2, sumy2]
type Ord2BivState = [number, number, number, number, number, number];

export class LinearRegressionAggregator implements Aggregator<Ord2BivState | null> {
  private fieldX: string;
  private fieldY: string;

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
    const [sum1, sumx, sumy, sumxy, sumx2, sumy2] = state;

    const beta = (sumxy * sum1 - sumx * sumy) / (sumx2 * sum1 - sumx ** 2);
    const alpha = (sumy - beta * sumx) / sum1;

    const sbetaNumerator = (sumy2 + alpha ** 2 * sum1 + beta ** 2 * sumx2 -
      2 * alpha * sumy + 2 * alpha * beta * sumx - 2 * beta * sumxy) / (sum1 - 2);
    const sbetaDenominator = sumx2 - sumx * sumx / sum1;
    const sbeta = Math.sqrt(sbetaNumerator / sbetaDenominator);
    const salpha = sbeta * Math.sqrt(sumx2 / sum1);

    return {
      alpha,
      beta,
      beta_se: sbeta,
      alpha_se: salpha,
    };
  }
}

aggregatorRegistry.register("linreg", {
  create: (fieldX: string, fieldY: string) => new LinearRegressionAggregator(fieldX, fieldY),
  argCounts: [2],
  shortUsage: "perform a linear regression of provided fields, dumping various statistics",
  longUsage: "Usage: linreg,<x field>,<y field>\n   Dump various status from a linear regression of y against x.",
  aliases: ["linearregression"],
});
