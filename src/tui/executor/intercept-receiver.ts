import type { RecordReceiver } from "../../Operation.ts";
import type { Record } from "../../Record.ts";

/**
 * A RecordReceiver that intercepts records flowing through a pipeline,
 * collecting them for inspection in the TUI. Tracks field names and
 * record counts for the inspector panel.
 */
export class InterceptReceiver implements RecordReceiver {
  records: Record[] = [];
  fieldNames = new Set<string>();
  recordCount = 0;
  lines: string[] = [];

  acceptRecord(record: Record): boolean {
    this.recordCount++;
    for (const key of record.keys()) {
      this.fieldNames.add(key);
    }
    this.records.push(record.clone());
    return true;
  }

  acceptLine(line: string): boolean {
    this.lines.push(line);
    return true;
  }

  finish(): void {
    // Nothing to do — results are read from records/fieldNames/recordCount
  }
}
