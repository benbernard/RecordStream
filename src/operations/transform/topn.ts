import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey } from "../../KeySpec.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * Output the top N records from the input stream, optionally grouped by key.
 *
 * Analogous to App::RecordStream::Operation::topn in Perl.
 */
export class TopnOperation extends Operation {
  extraArgs: string[] = [];
  keyGroups = new KeyGroups();
  num = 10;
  delimiter = "9t%7Oz%]";
  keySpecs: string[] | null = null;
  numSeen = new Map<string, number>();

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Key fields to group by",
      },
      {
        long: "topn",
        short: "n",
        type: "number",
        handler: (v) => { this.num = Number(v); },
        description: "Number of records to output (default 10)",
      },
      {
        long: "delimiter",
        type: "string",
        handler: (v) => { this.delimiter = v as string; },
        description: "Internal delimiter for composite keys",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (!this.num) {
      throw new Error("Must specify --topn <value>");
    }
  }

  initKeys(record: Record): void {
    this.keySpecs = this.keyGroups.getKeyspecs(record.dataRef() as JsonObject);
  }

  acceptRecord(record: Record): boolean {
    if (!this.keySpecs) {
      this.initKeys(record);
    }

    let currentKeyValues = "";
    for (const k of this.keySpecs!) {
      const val = findKey(record.dataRef() as JsonObject, k, true);
      currentKeyValues += String(val ?? "") + this.delimiter;
    }

    const count = (this.numSeen.get(currentKeyValues) ?? 0) + 1;
    this.numSeen.set(currentKeyValues, count);

    if (count <= this.num) {
      this.pushRecord(record);
    }

    return true;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "topn",
  category: "transform",
  synopsis: "recs topn [options] [files...]",
  description:
    "Output the top N records from the input stream or from files. You may " +
    "segment the input based on a list of keys such that unique values of " +
    "keys are treated as distinct input streams. This enables top-N listings " +
    "per value groupings. The key values need not be contiguous in the input.",
  options: [
    {
      flags: ["--key", "-k"],
      description:
        "Comma-separated list of fields to group by. May be specified multiple " +
        "times. May be a keyspec or keygroup.",
      argument: "<keyspec>",
    },
    {
      flags: ["--topn", "-n"],
      description: "Number of records to output. Default is 10.",
      argument: "<number>",
    },
    {
      flags: ["--delimiter"],
      description:
        "String used internally to delimit values when performing a topn on " +
        "a keyspec that includes multiple keys.",
      argument: "<string>",
    },
  ],
  examples: [
    {
      description: "Output just the top 5 records",
      command: "recs topn -n 5",
    },
    {
      description: "Output 10 records for each area",
      command: "recs sort --key area | recs topn -n 10 --key area",
    },
    {
      description: "Output the top 10 longest running queries per area and priority level",
      command:
        "recs sort --key area,priority,runtime=-n | recs topn -n 10 --key area,priority",
    },
  ],
  seeAlso: ["sort", "grep"],
};
