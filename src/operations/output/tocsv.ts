import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey } from "../../KeySpec.ts";
import type { JsonValue } from "../../types/json.ts";

/**
 * Outputs records as CSV formatted lines.
 * With the --delim option, it can output TSV or other character-separated formats.
 *
 * Analogous to App::RecordStream::Operation::tocsv in Perl.
 */
export class ToCsv extends Operation {
  keyGroups = new KeyGroups();
  showHeader = true;
  delimiter = ",";
  keys: string[] | null = null;
  first = true;

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
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Comma separated keys to output",
      },
      {
        long: "noheader",
        type: "boolean",
        handler: () => { this.showHeader = false; },
        description: "Do not output headers on the first line",
      },
      {
        long: "nh",
        type: "boolean",
        handler: () => { this.showHeader = false; },
        description: "Do not output headers on the first line",
      },
      {
        long: "delim",
        short: "d",
        type: "string",
        handler: (v) => { this.delimiter = v as string; },
        description: "Field delimiter character",
      },
    ];

    this.parseOptions(args, defs);

    if (this.delimiter.length !== 1) {
      throw new Error("Delimiter must be a single character");
    }
  }

  acceptRecord(record: Record): boolean {
    const data = record.dataRef();

    if (this.first) {
      this.first = false;

      if (this.keyGroups.hasAnyGroup()) {
        this.keys = this.keyGroups.getKeyspecs(data);
      } else {
        this.keys = Object.keys(data).sort();
      }

      if (this.showHeader) {
        this.outputValues(this.keys);
      }
    }

    const values: string[] = [];
    for (const key of this.keys!) {
      const val = findKey(data, key, true);
      values.push(formatCsvValue(val));
    }

    this.outputValues(values);
    return true;
  }

  outputValues(values: string[]): void {
    const line = values.map((v) => csvEscape(v, this.delimiter)).join(this.delimiter);
    this.pushLine(line);
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs tocsv <options> [files]
   This script outputs csv formatted recs.  With the --delim option, it can
   output tsv or other line-based formats with character-separated fields.

Arguments:
  --noheader|--nh    Do not output headers on the first line
  --key|-k <keyspec> Comma separated keys to output. Defaults to all fields in first record.
  --delim|-d <char>  Field delimiter (default ',').

Examples
  # Print records to csv format with headers
  recs tocsv myrecords

  # Only print time and a nested value of stat/avg
  ... | recs tocsv --key time,stat/avg`;
  }
}

function formatCsvValue(val: JsonValue | undefined): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function csvEscape(value: string, delimiter: string): string {
  // If the value contains the delimiter, quotes, or newlines, wrap in quotes
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "tocsv",
  category: "output",
  synopsis: "recs tocsv [options] [files...]",
  description:
    "Outputs records as CSV formatted lines. With the --delim option, it can output TSV or other line-based formats with character-separated fields.",
  options: [
    {
      flags: ["--key", "-k"],
      argument: "<keyspec>",
      description:
        "Comma separated keys to output. Defaults to all fields in the first record. May be a keyspec or a keygroup.",
    },
    {
      flags: ["--noheader", "--nh"],
      description: "Do not output headers on the first line.",
    },
    {
      flags: ["--delim", "-d"],
      argument: "<character>",
      description: "Field delimiter character to use when outputting lines (default ',').",
    },
  ],
  examples: [
    {
      description: "Print records to csv format with headers",
      command: "recs tocsv myrecords",
    },
    {
      description: "Only print time and a nested value of stat/avg",
      command: "... | recs tocsv --key time,stat/avg",
    },
  ],
  seeAlso: ["fromcsv"],
};
