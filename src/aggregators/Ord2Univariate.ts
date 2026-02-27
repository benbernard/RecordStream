import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

// [count, sumX, sumX2, sumX3, sumX4]
type Ord2UniState = [number, number, number, number, number];

/**
 * Second-order univariate statistics aggregator.
 * Computes count, mean, variance, standard deviation, skewness, and kurtosis
 * for a single field using a single pass.
 *
 * Analogous to App::RecordStream::Aggregator::Ord2Univariate in Perl.
 */
export class Ord2UnivariateAggregator implements Aggregator<Ord2UniState | null> {
  field: string;

  constructor(field: string) {
    this.field = field;
  }

  initial(): Ord2UniState | null {
    return null;
  }

  combine(state: Ord2UniState | null, record: Record): Ord2UniState | null {
    const value = findKey(record.dataRef(), this.field, true);
    if (value === undefined || value === null) return state;
    const x = Number(value);
    const mapped: Ord2UniState = [1, x, x * x, x * x * x, x * x * x * x];
    if (state === null) return mapped;
    return [
      state[0] + mapped[0],
      state[1] + mapped[1],
      state[2] + mapped[2],
      state[3] + mapped[3],
      state[4] + mapped[4],
    ];
  }

  squish(state: Ord2UniState | null): JsonValue {
    if (state === null) return null;
    const [n, sumX, sumX2, sumX3, sumX4] = state;

    const mean = sumX / n;
    const variance = sumX2 / n - mean * mean;
    const stddev = Math.sqrt(variance);

    const result: { [key: string]: JsonValue } = {
      count: n,
      mean,
      variance,
      stddev,
    };

    // Skewness and kurtosis require variance > 0
    if (variance > 0) {
      // E[(X - mean)^3] = E[X^3] - 3*mean*E[X^2] + 2*mean^3
      const m3 = sumX3 / n - 3 * mean * (sumX2 / n) + 2 * mean * mean * mean;
      result["skewness"] = m3 / (stddev * stddev * stddev);

      // E[(X - mean)^4] = E[X^4] - 4*mean*E[X^3] + 6*mean^2*E[X^2] - 3*mean^4
      const m4 = sumX4 / n - 4 * mean * (sumX3 / n) + 6 * mean * mean * (sumX2 / n) - 3 * mean * mean * mean * mean;
      result["kurtosis"] = m4 / (variance * variance);
    }

    return result;
  }
}

aggregatorRegistry.register("ord2uni", {
  create: (field: string) => new Ord2UnivariateAggregator(field),
  argCounts: [1],
  shortUsage: "compute second-order univariate statistics for a field",
  longUsage:
    "Usage: ord2uni,<field>\n" +
    "   Compute count, mean, variance, standard deviation, skewness,\n" +
    "   and kurtosis for the specified field.",
  aliases: ["ord2univariate"],
});
