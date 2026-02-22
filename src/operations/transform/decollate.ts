import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { deaggregatorRegistry } from "../../Deaggregator.ts";
import type { Deaggregator } from "../../Deaggregator.ts";
import { Record } from "../../Record.ts";
import type { JsonValue } from "../../types/json.ts";

/**
 * Reverse of collate: takes a single record and produces multiple records
 * using deaggregators.
 *
 * Analogous to App::RecordStream::Operation::decollate in Perl.
 */
export class DecollateOperation extends Operation {
  deaggregators: Deaggregator[] = [];
  onlyDeaggregated = false;

  init(args: string[]): void {
    const deaggSpecs: string[] = [];

    const defs: OptionDef[] = [
      {
        long: "deaggregator",
        short: "d",
        type: "string",
        handler: (v) => {
          // Colon-separated list of deaggregator specs
          deaggSpecs.push(...(v as string).split(":"));
        },
        description: "Deaggregator specification (colon-separated)",
      },
      {
        long: "only",
        short: "o",
        type: "boolean",
        handler: () => { this.onlyDeaggregated = true; },
        description: "Only output deaggregated fields, excluding original record fields",
      },
      {
        long: "list-deaggregators",
        type: "boolean",
        handler: () => {
          throw new Error(deaggregatorRegistry.listImplementations());
        },
        description: "List available deaggregators",
      },
    ];

    this.parseOptions(args, defs);

    for (const spec of deaggSpecs) {
      this.deaggregators.push(deaggregatorRegistry.parse(spec));
    }
  }

  acceptRecord(record: Record): boolean {
    this.deaggregateRecursive(0, record);
    return true;
  }

  deaggregateRecursive(depth: number, record: Record): void {
    if (depth < this.deaggregators.length) {
      const deaggregator = this.deaggregators[depth]!;
      const results = deaggregator.deaggregate(record);

      for (const deaggregated of results) {
        let merged: Record;
        if (this.onlyDeaggregated) {
          // Extract only the fields that differ from the original record
          const origData = record.toJSON();
          const deaggData = deaggregated.toJSON();
          const onlyNew: { [key: string]: JsonValue } = {};
          for (const [k, v] of Object.entries(deaggData)) {
            if (!(k in origData) || origData[k] !== v) {
              onlyNew[k] = v;
            }
          }
          merged = new Record(onlyNew);
        } else {
          merged = new Record({
            ...record.toJSON(),
            ...deaggregated.toJSON(),
          });
        }
        this.deaggregateRecursive(depth + 1, merged);
      }
    } else {
      this.pushRecord(record);
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "decollate",
  category: "transform",
  synopsis: "recs decollate [options] [files...]",
  description:
    "Reverse of collate: takes a single record and produces multiple records " +
    "using deaggregators. Decollate records of input into output records.",
  options: [
    {
      flags: ["--deaggregator", "-d"],
      description: "Deaggregator specification (colon-separated).",
      argument: "<deaggregators>",
    },
    {
      flags: ["--only", "-o"],
      description:
        "Only output deaggregated fields, excluding original record fields. " +
        "Useful when you only want the expanded data, not the source record.",
    },
    {
      flags: ["--list-deaggregators"],
      description: "List available deaggregators and exit.",
    },
  ],
  examples: [
    {
      description: "Split the 'hosts' field into individual 'host' fields",
      command: "recs decollate --deaggregator 'split,hosts,/\\s*,\\s*/,host'",
    },
    {
      description: "Decollate and only keep deaggregated fields",
      command: "recs decollate --only -d 'unarray,items,,item'",
    },
  ],
  seeAlso: ["collate"],
};
