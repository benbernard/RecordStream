import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey, setKey } from "../../KeySpec.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * Compute differences between consecutive records for specified fields.
 *
 * Analogous to App::RecordStream::Operation::delta in Perl.
 */
export class DeltaOperation extends Operation {
  extraArgs: string[] = [];
  keyGroups = new KeyGroups();
  lastRecord: Record | null = null;

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
        description: "Fields to compute deltas on",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (!this.keyGroups.hasAnyGroup()) {
      throw new Error("Must specify --key");
    }
  }

  acceptRecord(record: Record): boolean {
    const lastRecord = this.lastRecord;

    if (lastRecord) {
      const keys = this.keyGroups.getKeyspecs(lastRecord.dataRef() as JsonObject);

      for (const key of keys) {
        const currentVal = findKey(record.dataRef() as JsonObject, key, true);
        const lastVal = findKey(lastRecord.dataRef() as JsonObject, key, true);

        if (currentVal != null && lastVal != null &&
            typeof currentVal === "number" && typeof lastVal === "number") {
          setKey(lastRecord.dataRef() as JsonObject, key, currentVal - lastVal);
        } else if (
          currentVal != null && lastVal != null &&
          !isNaN(Number(currentVal)) && !isNaN(Number(lastVal))
        ) {
          setKey(lastRecord.dataRef() as JsonObject, key, Number(currentVal) - Number(lastVal));
        } else {
          setKey(lastRecord.dataRef() as JsonObject, key, null);
        }
      }

      this.pushRecord(lastRecord);
    }

    this.lastRecord = record;
    return true;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "delta",
  category: "transform",
  synopsis: "recs delta [options] [files...]",
  description:
    "Transforms absolute values into deltas between adjacent records. " +
    "Fields specified by --key are replaced with the difference between " +
    "the current and previous record values. Fields not in this list " +
    "are passed through unchanged, using the first record of each delta pair.",
  options: [
    {
      flags: ["--key", "-k"],
      description:
        "Comma-separated list of the fields that should be transformed. " +
        "May be a keyspec or a keygroup.",
      argument: "<keys>",
      required: true,
    },
  ],
  examples: [
    {
      description: "Transform a cumulative counter of errors into a count of errors per record",
      command: "recs delta --key errors",
    },
  ],
  seeAlso: ["xform", "collate"],
};
