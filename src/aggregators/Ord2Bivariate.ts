import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

// [sum1, sumX, sumY, sumXY, sumX2, sumY2]
type Ord2BivState = [number, number, number, number, number, number];

/**
 * Second-order bivariate statistics aggregator.
 * Computes covariance, correlation, and linear regression parameters
 * between two fields using a single pass.
 *
 * Analogous to App::RecordStream::Aggregator::Ord2Bivariate in Perl.
 */
export class Ord2BivariateAggregator implements Aggregator<Ord2BivState | null> {
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
      state[0] + mapped[0],
      state[1] + mapped[1],
      state[2] + mapped[2],
      state[3] + mapped[3],
      state[4] + mapped[4],
      state[5] + mapped[5],
    ];
  }

  squish(state: Ord2BivState | null): JsonValue {
    if (state === null) return null;
    const [n, sumX, sumY, sumXY, sumX2, sumY2] = state;

    const meanX = sumX / n;
    const meanY = sumY / n;

    // Covariance: E[XY] - E[X]*E[Y]
    const covariance = sumXY / n - meanX * meanY;

    // Variances
    const varX = sumX2 / n - meanX * meanX;
    const varY = sumY2 / n - meanY * meanY;

    // Correlation: cov / (stdX * stdY)
    const denominator = Math.sqrt(varX * varY);
    const correlation = denominator > 0
      ? (sumXY * n - sumX * sumY) / Math.sqrt((sumX2 * n - sumX ** 2) * (sumY2 * n - sumY ** 2))
      : null;

    // Linear regression: y = alpha + beta * x
    const betaDenom = sumX2 * n - sumX ** 2;
    const beta = betaDenom !== 0 ? (sumXY * n - sumX * sumY) / betaDenom : null;
    const alpha = beta !== null ? (sumY - beta * sumX) / n : null;

    const result: { [key: string]: JsonValue } = {
      count: n,
      covariance,
      correlation,
    };

    if (alpha !== null && beta !== null) {
      result["alpha"] = alpha;
      result["beta"] = beta;
    }

    return result;
  }
}

aggregatorRegistry.register("ord2biv", {
  create: (fieldX: string, fieldY: string) => new Ord2BivariateAggregator(fieldX, fieldY),
  argCounts: [2],
  shortUsage: "compute second-order bivariate statistics for two fields",
  longUsage:
    "Usage: ord2biv,<field1>,<field2>\n" +
    "   Compute covariance, correlation, and linear regression parameters\n" +
    "   between two fields.",
  aliases: ["ord2bivariate"],
});
