import { Record } from "../../../src/Record.ts";
import { Operation, type RecordReceiver } from "../../../src/Operation.ts";

/**
 * A receiver that captures lines (not records).
 * Output operations typically produce text lines rather than downstream records.
 */
export class LineCollector implements RecordReceiver {
  readonly lines: string[] = [];

  acceptRecord(_record: Record): boolean {
    // Output operations typically don't push records downstream
    return true;
  }

  acceptLine(line: string): boolean {
    this.lines.push(line);
    return true;
  }

  finish(): void {
    // no-op
  }

  output(): string {
    return this.lines.map((l) => l + "\n").join("");
  }
}

/**
 * Create an operation with a line collector, feed it input, and return the output.
 */
export function testOutput(
  OpClass: new (next?: RecordReceiver) => Operation,
  args: string[],
  input: string
): string {
  const collector = new LineCollector();
  const op = new OpClass(collector);
  op.init(args);

  const lines = input.split("\n").filter((l) => l.trim() !== "");
  for (const line of lines) {
    op.acceptLine(line);
  }
  op.finish();

  return collector.output();
}

/**
 * Helper to parse input records from JSON lines.
 */
export function parseRecords(input: string): Record[] {
  return input
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => Record.fromJSON(l));
}
