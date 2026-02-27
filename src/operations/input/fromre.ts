import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { setKey } from "../../KeySpec.ts";

/**
 * Match regex against lines, capture groups become fields.
 *
 * Analogous to App::RecordStream::Operation::fromre in Perl.
 */
export class FromRe extends Operation {
  fields: string[] = [];
  pattern: RegExp | null = null;
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
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (this.extraArgs.length === 0) {
      throw new Error("Missing expression");
    }

    this.pattern = new RegExp(this.extraArgs.shift()!);
  }

  acceptRecord(_record: Record): boolean {
    return true;
  }

  processLine(line: string): void {
    if (!this.pattern) return;

    const match = this.pattern.exec(line);
    if (match) {
      const record = new Record();
      const data = record.dataRef();

      // Groups start at index 1
      for (let i = 1; i < match.length; i++) {
        const fieldIndex = i - 1;
        const key = this.fields[fieldIndex] ?? String(fieldIndex);
        setKey(data, key, match[i]!);
      }

      this.pushRecord(record);
    }
  }

  override acceptLine(line: string): boolean {
    this.processLine(line);
    return true;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromre",
  category: "input",
  synopsis: "recs fromre [options] <re> [<files>]",
  description:
    "The regex <re> is matched against each line of input (or lines of <files>). Each successful match results in one output record whose field values are the capture groups from the match. Lines that do not match are ignored. Keys are named numerically (0, 1, etc.) or as given by --key.",
  options: [
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
  ],
  examples: [
    {
      description: "Parse greetings",
      command:
        "recs fromre --key name,age '^Hello, my name is (.*) and I am (\\d*) years? old$'",
    },
    {
      description: "Parse a single key named time from a group of digits at the beginning of the line",
      command: "recs fromre --key time '^(\\d+)'",
    },
    {
      description: "Map three sets of <>s to a record with keys named 0, 1, and 2",
      command: "recs fromre '<(.*)>\\s*<(.*)>\\s*<(.*)>'",
    },
  ],
  seeAlso: ["fromsplit", "frommultire"],
};
