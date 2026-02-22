import type { Record } from "./Record.ts";
import { BaseRegistry } from "./BaseRegistry.ts";

/**
 * Base interface for deaggregators.
 *
 * Deaggregators take a single record and produce multiple records,
 * essentially the reverse of aggregation.
 *
 * Analogous to App::RecordStream::Deaggregator in Perl.
 */
export interface Deaggregator {
  /** Take a record and produce zero or more output records. */
  deaggregate(record: Record): Record[];
}

/**
 * The global deaggregator registry.
 */
export const deaggregatorRegistry = new BaseRegistry<Deaggregator>("deaggregator");
