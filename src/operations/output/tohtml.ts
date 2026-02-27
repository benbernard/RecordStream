import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey } from "../../KeySpec.ts";
import type { JsonValue } from "../../types/json.ts";

/**
 * Outputs records as an HTML table.
 *
 * Analogous to App::RecordStream::Operation::tohtml in Perl.
 */
export class ToHtml extends Operation {
  keyGroups = new KeyGroups();
  noHeader = false;
  rowAttributes = "";
  cellAttributes = "";
  printedStart = false;
  fields: string[] = [];

  constructor(next?: RecordReceiver) {
    super(next);
  }

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
    this.useHelpType("keygroups");
    this.useHelpType("keys");
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "keys",
        short: "k",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Keys to print in the table",
      },
      {
        long: "key",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Keys to print in the table",
      },
      {
        long: "fields",
        short: "f",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Keys to print in the table",
      },
      {
        long: "noheader",
        type: "boolean",
        handler: () => { this.noHeader = true; },
        description: "Do not print the header row",
      },
      {
        long: "rowattributes",
        type: "string",
        handler: (v) => { this.rowAttributes = v as string; },
        description: "HTML attributes for tr tags",
      },
      {
        long: "row",
        type: "string",
        handler: (v) => { this.rowAttributes = v as string; },
        description: "HTML attributes for tr tags",
      },
      {
        long: "cellattributes",
        type: "string",
        handler: (v) => { this.cellAttributes = v as string; },
        description: "HTML attributes for td and th tags",
      },
      {
        long: "cell",
        type: "string",
        handler: (v) => { this.cellAttributes = v as string; },
        description: "HTML attributes for td and th tags",
      },
    ];

    this.parseOptions(args, defs);
  }

  acceptRecord(record: Record): boolean {
    const data = record.dataRef();

    this.printStart(data);

    const rowAttrs = this.rowAttributes ? " " + this.rowAttributes : "";
    const cellAttrs = this.cellAttributes ? " " + this.cellAttributes : "";

    this.pushLine(`  <tr${rowAttrs}>`);

    for (const field of this.fields) {
      const val = findKey(data, field, true);
      const value = formatHtmlValue(val);
      this.pushLine(`    <td${cellAttrs}>${value}</td>`);
    }

    this.pushLine("  </tr>");
    return true;
  }

  printStart(data: { [key: string]: JsonValue }): void {
    if (this.printedStart) return;
    this.printedStart = true;

    this.pushLine("<table>");

    if (this.keyGroups.hasAnyGroup()) {
      this.fields = this.keyGroups.getKeyspecs(data);
    } else {
      this.fields = Object.keys(data).sort();
    }

    if (!this.noHeader) {
      this.printHeader();
    }
  }

  printHeader(): void {
    const rowAttrs = this.rowAttributes ? " " + this.rowAttributes : "";
    const cellAttrs = this.cellAttributes ? " " + this.cellAttributes : "";

    this.pushLine(`  <tr${rowAttrs}>`);

    for (const field of this.fields) {
      this.pushLine(`    <th${cellAttrs}>${field}</th>`);
    }

    this.pushLine("  </tr>");
  }

  override streamDone(): void {
    this.pushLine("</table>");
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs tohtml <args> [<files>]
   Prints out an html table for the records from input or from <files>.

Arguments:
  --keys|-k <keys>     Keys to print in the table
  --noheader           Do not print the header row
  --rowattributes      HTML attributes for tr tags
  --cellattributes     HTML attributes for td and th tags

Examples:
   Print all fields
      recs tohtml
   Print foo and bar fields, without a header
      recs tohtml --fields foo,bar --noheader`;
  }
}

function formatHtmlValue(val: JsonValue | undefined): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "tohtml",
  category: "output",
  synopsis: "recs tohtml [options] [files...]",
  description:
    "Prints out an HTML table for the records from input or from files.",
  options: [
    {
      flags: ["--keys", "-k", "--key", "--fields", "-f"],
      argument: "<keys>",
      description:
        "Keys to print in the table. May be specified multiple times or comma separated. Defaults to all fields in the first record.",
    },
    {
      flags: ["--noheader"],
      description: "Do not print the header row.",
    },
    {
      flags: ["--rowattributes", "--row"],
      argument: "<attributes>",
      description: "HTML attributes to put on the tr tags.",
    },
    {
      flags: ["--cellattributes", "--cell"],
      argument: "<attributes>",
      description: "HTML attributes to put on the td and th tags.",
    },
  ],
  examples: [
    {
      description: "Print all fields as an HTML table",
      command: "recs tohtml",
    },
    {
      description: "Print foo and bar fields, without a header",
      command: "recs tohtml --fields foo,bar --noheader",
    },
  ],
  seeAlso: ["totable", "toprettyprint"],
};
