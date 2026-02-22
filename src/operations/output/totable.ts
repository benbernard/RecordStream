import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { Accumulator } from "../../Accumulator.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey } from "../../KeySpec.ts";

/**
 * Pretty prints records as an ASCII table with column alignment.
 * Reads the entire record stream to determine column sizes.
 *
 * Analogous to App::RecordStream::Operation::totable in Perl.
 */
export class ToTable extends Operation {
  accumulator = new Accumulator();
  keyGroups = new KeyGroups();
  noHeader = false;
  delimiter = "\t";
  spreadsheet = false;
  clearMode = false;
  fieldOrder: string[] = [];

  constructor(next?: RecordReceiver) {
    super(next);
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "no-header",
        short: "n",
        type: "boolean",
        handler: () => { this.noHeader = true; },
        description: "Do not print column headers",
      },
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Specify fields to put in the table",
      },
      {
        long: "field",
        short: "f",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Specify fields to put in the table",
      },
      {
        long: "delim",
        short: "d",
        type: "string",
        handler: (v) => { this.delimiter = v as string; },
        description: "Delimiter for spreadsheet mode",
      },
      {
        long: "spreadsheet",
        short: "s",
        type: "boolean",
        handler: () => { this.spreadsheet = true; },
        description: "Print in spreadsheet-compatible format",
      },
      {
        long: "clear",
        type: "boolean",
        handler: () => { this.clearMode = true; },
        description: "Put blanks in cells where the row matches above",
      },
    ];

    this.parseOptions(args, defs);

    if (!this.keyGroups.hasAnyGroup()) {
      this.keyGroups.addGroups("!.!rr!s");
    }
  }

  acceptRecord(record: Record): boolean {
    this.accumulator.acceptRecord(record);
    return true;
  }

  override streamDone(): void {
    const records = this.accumulator.getRecords();
    if (records.length === 0) return;

    const widths: Map<string, number> = new Map();
    const fields: string[] = [];

    // Determine fields and their maximum widths
    for (const record of records) {
      const data = record.dataRef();
      const specs = this.keyGroups.getKeyspecsForRecord(data);

      for (const field of specs) {
        if (!widths.has(field)) {
          widths.set(field, 0);
          fields.push(field);
        }
        const val = this.extractField(record, field);
        const currentMax = widths.get(field)!;
        if (val.length > currentMax) {
          widths.set(field, val.length);
        }
      }
    }

    // If showing headers, also account for header widths
    if (!this.noHeader) {
      for (const field of fields) {
        const currentMax = widths.get(field)!;
        if (field.length > currentMax) {
          widths.set(field, field.length);
        }
      }
    }

    this.fieldOrder = fields;

    // Print header
    if (!this.noHeader) {
      this.pushLine(
        this.formatRow(fields, widths, (_field, fieldName) => fieldName)
      );

      if (!this.spreadsheet) {
        this.pushLine(
          this.formatRow(fields, widths, (_field, fieldName) => "-".repeat(widths.get(fieldName)!))
        );
      }
    }

    // Print data rows
    const last: Map<string, string> = new Map();
    for (const field of fields) {
      last.set(field, "");
    }

    for (const record of records) {
      this.pushLine(
        this.formatRow(fields, widths, (field, _fieldName) => {
          return this.formatField(record, field, last);
        })
      );
    }
  }

  formatField(record: Record, field: string, last: Map<string, string>): string {
    let value = this.extractField(record, field);

    if (this.clearMode) {
      if (value === last.get(field)) {
        value = "";
      } else {
        // Invalidate all fields to the right
        let startInvalidating = false;
        for (const f of this.fieldOrder) {
          if (f === field) {
            startInvalidating = true;
          } else if (startInvalidating) {
            last.set(f, "");
          }
        }
        last.set(field, value);
      }
    }

    return value;
  }

  formatRow(
    fields: string[],
    widths: Map<string, number>,
    formatter: (field: string, fieldName: string) => string
  ): string {
    let first = true;
    let row = "";

    for (const field of fields) {
      let fieldStr = formatter(field, field);

      if (!this.spreadsheet && fieldStr.length < widths.get(field)!) {
        fieldStr += " ".repeat(widths.get(field)! - fieldStr.length);
      }

      if (first) {
        first = false;
      } else {
        row += this.spreadsheet ? this.delimiter : "   ";
      }

      row += fieldStr;
    }

    return row;
  }

  extractField(record: Record, field: string): string {
    const data = record.dataRef();
    const val = findKey(data, field, true);
    if (val === undefined || val === null) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs totable <args> [<files>]
   Pretty prints a table of records to the screen. Will read in the entire
   record stream to determine column size, and number of columns.

Arguments:
  --no-header|-n         Do not print column headers
  --key|-k <field name>  Specifies fields for the table
  --spreadsheet|-s       Print in spreadsheet format
  --delim|-d <string>    Delimiter for spreadsheet mode (default tab)
  --clear                Put blanks in cells where all row so far matches above

Examples:
   Display a table
      recs totable
   Display only one field
      recs totable -f foo
   Display two fields without a header
      recs totable -f foo -f bar --no-header`;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "totable",
  category: "output",
  synopsis: "recs totable [options] [files...]",
  description:
    "Pretty prints a table of records to the screen. Will read in the entire record stream to determine column size and number of columns.",
  options: [
    {
      flags: ["--no-header", "-n"],
      description: "Do not print column headers.",
    },
    {
      flags: ["--key", "-k", "--field", "-f"],
      argument: "<field name>",
      description:
        "Specifies fields to put in the table. May be comma separated or specified multiple times. May be a keyspec or a keygroup.",
    },
    {
      flags: ["--spreadsheet", "-s"],
      description:
        "Print in spreadsheet-compatible format. Does not print line of dashes after header. Separates by single character rather than series of spaces.",
    },
    {
      flags: ["--delim", "-d"],
      argument: "<string>",
      description:
        "Only useful with --spreadsheet. Delimit with the given string rather than the default of a tab.",
    },
    {
      flags: ["--clear"],
      description:
        "Put blanks in cells where all of the row so far matches the row above.",
    },
  ],
  examples: [
    {
      description: "Display a table",
      command: "recs totable",
    },
    {
      description: "Display only one field",
      command: "recs totable -f foo",
    },
    {
      description: "Display two fields without a header",
      command: "recs totable -f foo -f bar --no-header",
    },
  ],
  seeAlso: ["toprettyprint", "tohtml"],
};
