import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";

// Import registry to ensure all aggregators are registered
import "../../src/aggregators/registry.ts";
import { aggregatorRegistry } from "../../src/Aggregator.ts";

function runAggregator(spec: string, records: Record[]): unknown {
  const agg = aggregatorRegistry.parse(spec);
  let state = agg.initial();
  for (const rec of records) {
    state = agg.combine(state, rec);
  }
  return agg.squish(state);
}

describe("Variance aggregator", () => {
  test("computes variance", () => {
    const records = [2, 4, 4, 4, 5, 5, 7, 9].map((x) => new Record({ x }));
    const result = runAggregator("var,x", records) as number;
    // Mean = 5, Var = E[X^2] - E[X]^2 = (4+16+16+16+25+25+49+81)/8 - 25 = 232/8 - 25 = 4
    expect(result).toBeCloseTo(4);
  });

  test("variance alias works", () => {
    expect(aggregatorRegistry.has("variance")).toBe(true);
  });
});

describe("StandardDeviation aggregator", () => {
  test("computes standard deviation", () => {
    const records = [2, 4, 4, 4, 5, 5, 7, 9].map((x) => new Record({ x }));
    const result = runAggregator("stddev,x", records) as number;
    expect(result).toBeCloseTo(2);
  });
});

describe("Correlation aggregator", () => {
  test("computes correlation for perfectly correlated data", () => {
    const records = [
      new Record({ x: 1, y: 2 }),
      new Record({ x: 2, y: 4 }),
      new Record({ x: 3, y: 6 }),
    ];
    const result = runAggregator("corr,x,y", records) as number;
    expect(result).toBeCloseTo(1.0);
  });

  test("computes correlation for negatively correlated data", () => {
    const records = [
      new Record({ x: 1, y: 6 }),
      new Record({ x: 2, y: 4 }),
      new Record({ x: 3, y: 2 }),
    ];
    const result = runAggregator("corr,x,y", records) as number;
    expect(result).toBeCloseTo(-1.0);
  });

  test("correlation aliases work", () => {
    expect(aggregatorRegistry.has("correl")).toBe(true);
    expect(aggregatorRegistry.has("correlation")).toBe(true);
  });
});

describe("Covariance aggregator", () => {
  test("computes covariance", () => {
    const records = [
      new Record({ x: 1, y: 2 }),
      new Record({ x: 2, y: 4 }),
      new Record({ x: 3, y: 6 }),
    ];
    const result = runAggregator("cov,x,y", records) as number;
    // Cov(X,Y) = E[XY] - E[X]*E[Y]
    // E[XY] = (2+8+18)/3 = 28/3
    // E[X] = 2, E[Y] = 4
    // Cov = 28/3 - 8 = 4/3
    expect(result).toBeCloseTo(4 / 3);
  });

  test("covariance aliases work", () => {
    expect(aggregatorRegistry.has("covar")).toBe(true);
    expect(aggregatorRegistry.has("covariance")).toBe(true);
  });
});

describe("LinearRegression aggregator", () => {
  test("computes linear regression", () => {
    const records = [
      new Record({ x: 1, y: 3 }),
      new Record({ x: 2, y: 5 }),
      new Record({ x: 3, y: 7 }),
      new Record({ x: 4, y: 9 }),
      new Record({ x: 5, y: 11 }),
    ];
    const result = runAggregator("linreg,x,y", records) as { alpha: number; beta: number };
    // y = 1 + 2*x => alpha=1, beta=2
    expect(result.alpha).toBeCloseTo(1);
    expect(result.beta).toBeCloseTo(2);
  });

  test("linearregression alias works", () => {
    expect(aggregatorRegistry.has("linearregression")).toBe(true);
  });
});

describe("Percentile aggregator", () => {
  test("computes 50th percentile (median)", () => {
    const records = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
      (x) => new Record({ x })
    );
    const result = runAggregator("perc,50,x", records);
    expect(result).toBe(6);
  });

  test("computes 90th percentile", () => {
    const records = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
      (x) => new Record({ x })
    );
    const result = runAggregator("perc,90,x", records);
    expect(result).toBe(10);
  });

  test("percentile alias works", () => {
    expect(aggregatorRegistry.has("percentile")).toBe(true);
  });
});

describe("PercentileMap aggregator", () => {
  test("computes multiple percentiles", () => {
    const records = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
      (x) => new Record({ x })
    );
    const result = runAggregator("percmap,25 50 75,x", records) as { [key: string]: number };
    expect(result).toEqual({
      "25": 3,
      "50": 6,
      "75": 8,
    });
  });
});

describe("Mode aggregator", () => {
  test("finds most common value", () => {
    const records = [
      new Record({ x: "a" }),
      new Record({ x: "b" }),
      new Record({ x: "a" }),
      new Record({ x: "c" }),
      new Record({ x: "a" }),
    ];
    const result = runAggregator("mode,x", records);
    expect(result).toBe("a");
  });
});
