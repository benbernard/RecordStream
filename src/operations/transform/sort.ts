import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Accumulator } from "../../Accumulator.ts";
import { Record } from "../../Record.ts";

/**
 * Sort records by key(s), supports numeric/lexical/custom comparators, reverse.
 *
 * Analogous to App::RecordStream::Operation::sort in Perl.
 */
export class SortOperation extends Operation {
  accumulator = new Accumulator();
  keys: string[] = [];
  reverse = false;
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
          this.keys.push(...(v as string).split(","));
        },
        description: "Sort key specification (field or field=sortType)",
      },
      {
        long: "reverse",
        short: "r",
        type: "boolean",
        handler: () => { this.reverse = true; },
        description: "Reverse the sort order",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);
  }

  acceptRecord(record: Record): boolean {
    this.accumulator.accumulateRecord(record);
    return true;
  }

  override streamDone(): void {
    let records = Record.sort(this.accumulator.getRecords(), ...this.keys);

    if (this.reverse) {
      records = records.reverse();
    }

    for (const record of records) {
      this.pushRecord(record);
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "sort",
  category: "transform",
  synopsis: "recs sort [options] [files...]",
  description:
    "Sort records from input or from files. You may sort on a list of keys, " +
    "each key sorted lexically (alpha order) or numerically. The sort type " +
    "may be prefixed with '-' to indicate decreasing order.",
  options: [
    {
      flags: ["--key", "-k"],
      description:
        "Sort key specification. May be comma-separated, may be specified " +
        "multiple times. Each keyspec is a name or name=sortType. Sort type " +
        "may be lexical, numeric, nat, lex, n, or l. May be prefixed with " +
        "'-' for decreasing order.",
      argument: "<keyspec>",
    },
    {
      flags: ["--reverse", "-r"],
      description: "Reverse the sort order.",
    },
  ],
  examples: [
    {
      description: "Sort on the id field numerically",
      command: "recs sort --key id=numeric",
    },
    {
      description: "Sort on age numerically, then name lexically",
      command: "recs sort --key age=numeric,name",
    },
    {
      description: "Sort on decreasing size, then name",
      command: "recs sort --key size=-numeric --key name",
    },
  ],
  seeAlso: ["collate", "topn"],
};
