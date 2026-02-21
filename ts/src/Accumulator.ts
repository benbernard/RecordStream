import type { Record } from "./Record.ts";

/**
 * Accumulator collects records into a buffer.
 * Used by operations that need to see all records before producing output.
 *
 * Analogous to App::RecordStream::Accumulator in Perl.
 */
export class Accumulator {
  private records: Record[] = [];

  acceptRecord(record: Record): void {
    this.accumulateRecord(record);
  }

  accumulateRecord(record: Record): void {
    this.records.push(record);
  }

  getRecords(): Record[] {
    return this.records;
  }

  clear(): void {
    this.records = [];
  }
}
