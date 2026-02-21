import type { Record } from "./Record.ts";
import { BaseRegistry } from "./BaseRegistry.ts";

/**
 * A ClumperCallback receives groups of records from a clumper.
 */
export interface ClumperCallback {
  /** Called when a new clumping session begins. Returns a cookie. */
  clumperCallbackBegin(options: ClumperOptions): unknown;
  /** Push a record into the current clumping session. */
  clumperCallbackPushRecord(cookie: unknown, record: Record): void;
  /** Called when the clumping session ends. */
  clumperCallbackEnd(cookie: unknown): void;
}

export interface ClumperOptions {
  [key: string]: unknown;
}

/**
 * Base interface for clumpers.
 *
 * Clumpers define a way of taking a stream of records and rearranging
 * them into groups. The most common use is grouping records for
 * aggregation by collate.
 *
 * Analogous to App::RecordStream::Clumper in Perl.
 */
export interface Clumper {
  /** Accept a record into the clumper. */
  acceptRecord(record: Record, callback: ClumperCallback, cookie: unknown): void;
  /** Signal that the stream is done. */
  streamDone(callback: ClumperCallback, cookie: unknown): void;
}

/**
 * The global clumper registry.
 */
export const clumperRegistry = new BaseRegistry<Clumper>("clumper");
