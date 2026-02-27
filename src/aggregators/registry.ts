/**
 * Aggregator registry - central place for registering and looking up
 * aggregators by name.
 *
 * Importing this module ensures all aggregator implementations are registered.
 */

// Import all aggregator implementations to trigger their self-registration
import "./Sum.ts";
import "./Count.ts";
import "./Average.ts";
import "./Maximum.ts";
import "./Minimum.ts";
import "./First.ts";
import "./Last.ts";
import "./Variance.ts";
import "./StandardDeviation.ts";
import "./Correlation.ts";
import "./LinearRegression.ts";
import "./Covariance.ts";
import "./Percentile.ts";
import "./PercentileMap.ts";
import "./Mode.ts";
import "./Records.ts";
import "./Array.ts";
import "./Concatenate.ts";
import "./UniqArray.ts";
import "./UniqConcatenate.ts";
import "./CountBy.ts";
import "./DistinctCount.ts";
import "./ValuesToKeys.ts";
import "./FirstRecord.ts";
import "./LastRecord.ts";
import "./RecordForMaximum.ts";
import "./RecordForMinimum.ts";
import "./Ord2Univariate.ts";
import "./Ord2Bivariate.ts";

export { aggregatorRegistry, makeAggregators } from "../Aggregator.ts";
