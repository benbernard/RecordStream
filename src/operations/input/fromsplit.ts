import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { setKey } from "../../KeySpec.ts";

/**
 * Split lines on a delimiter into records.
 *
 * Analogous to App::RecordStream::Operation::fromsplit in Perl.
 */
export class FromSplit extends Operation {
  fields: string[] = [];
  delimiter = ",";
  header = false;
  strict = false;
  extraArgs: string[] = [];

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => {
          this.fields.push(...(v as string).split(","));
        },
        description: "Comma separated list of key names",
      },
      {
        long: "field",
        short: "f",
        type: "string",
        handler: (v) => {
          this.fields.push(...(v as string).split(","));
        },
        description: "Comma separated list of key names",
      },
      {
        long: "delim",
        short: "d",
        type: "string",
        handler: (v) => {
          this.delimiter = v as string;
        },
        description: "Delimiter for splitting (default ',')",
      },
      {
        long: "header",
        type: "boolean",
        handler: () => {
          this.header = true;
        },
        description: "Take key names from the first line of input",
      },
      {
        long: "strict",
        type: "boolean",
        handler: () => {
          this.strict = true;
        },
        description: "Delimiter is not treated as a regex",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);
  }

  acceptRecord(_record: Record): boolean {
    return true;
  }

  processLine(line: string): void {
    if (this.header) {
      const values = this.splitLine(line);
      this.fields.push(...values);
      this.header = false;
      return;
    }

    const values = this.splitLine(line);
    const record = new Record();
    const data = record.dataRef();

    for (let i = 0; i < values.length; i++) {
      const key = this.fields[i] ?? String(i);
      setKey(data, key, values[i]!);
    }

    this.pushRecord(record);
  }

  override acceptLine(line: string): boolean {
    this.processLine(line);
    return true;
  }

  splitLine(line: string): string[] {
    if (this.strict) {
      // Literal split using escapeRegex
      return line.split(this.delimiter);
    } else {
      // Treat delimiter as regex
      const regex = new RegExp(this.delimiter);
      return line.split(regex);
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromsplit",
  category: "input",
  synopsis: "recs fromsplit [options] [<files>]",
  description:
    "Each line of input (or lines of <files>) is split on the provided delimiter to produce an output record. Keys are named numerically (0, 1, etc.) or as given by --key.",
  options: [
    {
      flags: ["--delim", "-d"],
      argument: "<delim>",
      description: "Delimiter to use for splitting input lines (default ',').",
    },
    {
      flags: ["--key", "-k"],
      argument: "<keys>",
      description:
        "Comma separated list of key names. May be specified multiple times, may be key specs.",
    },
    {
      flags: ["--field", "-f"],
      argument: "<keys>",
      description:
        "Comma separated list of key names. May be specified multiple times, may be key specs.",
    },
    {
      flags: ["--header"],
      description: "Take key names from the first line of input.",
    },
    {
      flags: ["--strict"],
      description: "Delimiter is not treated as a regex.",
    },
  ],
  examples: [
    {
      description: "Parse space separated keys x and y",
      command: "recs fromsplit --key x,y --delim ' '",
    },
    {
      description: "Parse comma separated keys a, b, and c",
      command: "recs fromsplit --key a,b,c",
    },
  ],
  seeAlso: ["fromcsv", "fromre"],
};
