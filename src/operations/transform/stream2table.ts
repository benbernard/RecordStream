import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { findKey } from "../../KeySpec.ts";
import { Record } from "../../Record.ts";
import type { JsonObject, JsonValue } from "../../types/json.ts";

/**
 * Convert a record stream to a 2D table format.
 * Groups records by a column field, then combines them row-by-row.
 *
 * Analogous to App::RecordStream::Operation::stream2table in Perl.
 */
export class Stream2TableOperation extends Operation {
  extraArgs: string[] = [];
  field = "";
  removeField = false;
  groups = new Map<string, Record[]>();

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "field",
        short: "f",
        type: "string",
        handler: (v) => { this.field = v as string; },
        description: "Field to use as the column key",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (!this.field) {
      throw new Error("You must specify a --field option");
    }

    // Only remove field from nested records if it's a simple field name
    this.removeField = !this.field.includes("/") && !this.field.includes("@");
  }

  acceptRecord(record: Record): boolean {
    const data = record.dataRef() as JsonObject;
    const key = String(findKey(data, this.field, true) ?? "");

    if (this.removeField) {
      record.remove(this.field);
    }

    const group = this.groups.get(key);
    if (group) {
      group.push(record);
    } else {
      this.groups.set(key, [record]);
    }

    return true;
  }

  override streamDone(): void {
    while (this.groups.size > 0) {
      const outputRecord = new Record();
      let found = false;

      for (const [key, records] of this.groups) {
        if (records.length > 0) {
          const oldRecord = records.shift()!;
          outputRecord.set(key, oldRecord.toJSON() as JsonValue);
          found = true;
        }

        if (records.length === 0) {
          this.groups.delete(key);
        }
      }

      if (found) {
        this.pushRecord(outputRecord);
      }
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "stream2table",
  category: "transform",
  synopsis: "recs stream2table [options] [files...]",
  description:
    "Transforms a list of records, combining records based on a column field. " +
    "In order, the values of the column will be added to the output records. " +
    "Note: this script spools the stream into memory. The full input record " +
    "will be associated with the value of the field. The field itself will be " +
    "removed from the nested record if it is not a key spec.",
  options: [
    {
      flags: ["--field", "-f"],
      description: "Field to use as the column key. May be a keyspec.",
      argument: "<FIELD>",
      required: true,
    },
  ],
  examples: [
    {
      description:
        "Transform a record stream with each stat on one line to a stream " +
        "with one value for each stat present on one line",
      command: "recs stream2table --field stat",
    },
    {
      description: "Combine records by column field",
      command: "recs stream2table --field column",
      input:
        '{"column":"foo","data":"foo1"}\n{"column":"foo","data":"foo2"}\n' +
        '{"column":"boo","data":"boo1"}\n{"column":"boo","data":"boo2"}',
      output:
        '{"boo":{"data":"boo1"},"foo":{"data":"foo1"}}\n' +
        '{"boo":{"data":"boo2"},"foo":{"data":"foo2"}}',
    },
  ],
  seeAlso: ["flatten", "collate"],
};
