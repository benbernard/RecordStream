import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver } from "../../Operation.ts";

/**
 * Outputs the record stream as a single JSON array.
 * Complements the fromjsonarray command.
 *
 * Analogous to App::RecordStream::Operation::tojsonarray in Perl.
 */
export class ToJsonArray extends Operation {
  count = 0;

  constructor(next?: RecordReceiver) {
    super(next);
  }

  init(args: string[]): void {
    this.parseOptions(args, []);
  }

  override acceptLine(line: string): boolean {
    if (this.count === 0) {
      this.pushLine("[" + line);
    } else {
      this.pushLine("," + line);
    }
    this.count++;
    return true;
  }

  acceptRecord(record: Record): boolean {
    return this.acceptLine(record.toString());
  }

  override streamDone(): void {
    if (this.count > 0) {
      this.pushLine("]");
    } else {
      this.pushLine("[]");
    }
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs tojsonarray [files]
   This command outputs the record stream as a single JSON array.  It
   complements the fromjsonarray command.

Examples
  # Save the record stream to a file suitable for loading by any JSON parser
  ... | recs tojsonarray > recs.json`;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "tojsonarray",
  category: "output",
  synopsis: "recs tojsonarray [files...]",
  description:
    "Outputs the record stream as a single JSON array. Complements the fromjsonarray command.",
  options: [],
  examples: [
    {
      description: "Save the record stream to a file suitable for loading by any JSON parser",
      command: "... | recs tojsonarray > recs.json",
    },
  ],
  seeAlso: ["fromjsonarray"],
};
