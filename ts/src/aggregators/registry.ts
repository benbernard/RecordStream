/**
 * Aggregator registry - central place for registering and looking up
 * aggregators by name.
 *
 * Re-exports the global registry from Aggregator.ts.
 * Individual aggregator implementations should register themselves here.
 */

export { aggregatorRegistry, makeAggregators } from "../Aggregator.ts";
