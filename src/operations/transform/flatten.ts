import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey, setKey } from "../../KeySpec.ts";
import { Record } from "../../Record.ts";
import type { JsonValue, JsonObject, JsonArray } from "../../types/json.ts";

interface FlattenField {
  depth: number;
  keyGroups: KeyGroups;
}

/**
 * Flatten nested hash/array structures into top-level fields.
 *
 * Analogous to App::RecordStream::Operation::flatten in Perl.
 */
export class FlattenOperation extends Operation {
  extraArgs: string[] = [];
  fields: FlattenField[] = [];
  separator = "-";
  defaultDepth = 1;

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "depth",
        type: "number",
        handler: (v) => { this.defaultDepth = Number(v); },
        description: "Default flatten depth (default 1, negative for unlimited)",
      },
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => {
          const kg = new KeyGroups(v as string);
          this.fields.push({ depth: this.defaultDepth, keyGroups: kg });
        },
        description: "Fields to flatten at the default depth",
      },
      {
        long: "deep",
        type: "string",
        handler: (v) => {
          const kg = new KeyGroups(v as string);
          this.fields.push({ depth: -1, keyGroups: kg });
        },
        description: "Fields to flatten to arbitrary depth",
      },
      {
        long: "separator",
        type: "string",
        handler: (v) => { this.separator = v as string; },
        description: "Separator for joined field names (default '-')",
      },
    ];

    // Handle numeric depth flags (--1, --2, etc.) manually
    const filteredArgs: string[] = [];
    let i = 0;
    while (i < args.length) {
      const arg = args[i]!;
      const numMatch = arg.match(/^--?(\d)$/);
      if (numMatch) {
        const depth = parseInt(numMatch[1]!, 10);
        i++;
        const fieldArg = args[i];
        if (fieldArg === undefined) {
          throw new Error(`Option ${arg} requires a value`);
        }
        const kg = new KeyGroups(fieldArg);
        this.fields.push({ depth, keyGroups: kg });
      } else {
        filteredArgs.push(arg);
      }
      i++;
    }

    this.extraArgs = this.parseOptions(filteredArgs, defs);
  }

  acceptRecord(record: Record): boolean {
    const data = record.dataRef() as JsonObject;

    for (const field of this.fields) {
      const specs = field.keyGroups.getKeyspecsForRecord(data);
      for (const spec of specs) {
        try {
          const value = this.removeSpec(record, spec);
          this.splitField(record, spec, field.depth, value);
        } catch (e) {
          if (e instanceof Error && e.message.includes("Cannot flatten into")) {
            console.warn(e.message);
            continue;
          }
          throw e;
        }
      }
    }

    this.pushRecord(record);
    return true;
  }

  removeSpec(record: Record, spec: string): JsonValue | undefined {
    // For simple top-level keys, just remove directly
    if (!spec.includes("/")) {
      const data = record.dataRef() as JsonObject;
      const value = data[spec];
      delete data[spec]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
      return value;
    }

    // For nested specs, navigate to the parent and remove the last key
    const parts = spec.split("/");
    const lastKey = parts.pop()!;
    const parentSpec = parts.join("/");

    const parent = findKey(record.dataRef() as JsonObject, parentSpec, true);
    if (typeof parent === "object" && parent !== null && !Array.isArray(parent)) {
      const obj = parent as JsonObject;
      const value = obj[lastKey];
      delete obj[lastKey]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
      return value;
    }
    throw new Error(`Cannot flatten into non-hash type for spec ${spec}`);
  }

  splitField(
    record: Record,
    name: string,
    depth: number,
    value: JsonValue | undefined
  ): void {
    if (depth !== 0 && Array.isArray(value)) {
      for (let i = 0; i < (value as JsonArray).length; i++) {
        this.splitField(record, name + this.separator + i, depth - 1, (value as JsonArray)[i]);
      }
      return;
    }

    if (depth !== 0 && typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const key of Object.keys(value as JsonObject)) {
        this.splitField(record, name + this.separator + key, depth - 1, (value as JsonObject)[key]);
      }
      return;
    }

    // Either depth is 0 or it wasn't expandable
    setKey(record.dataRef() as JsonObject, name, value ?? null);
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "flatten",
  category: "transform",
  synopsis: "recs flatten [options] [files...]",
  description:
    "Flatten nested hash/array structures in records into top-level fields. " +
    "Note: this implements a strategy for dealing with nested structures " +
    "that is almost always better handled by using keyspecs or keygroups.",
  options: [
    {
      flags: ["--depth"],
      description:
        "Change the default flatten depth. Negative values mean arbitrary depth. Default is 1.",
      argument: "<number>",
    },
    {
      flags: ["--key", "-k"],
      description: "Comma-separated list of fields to flatten at the default depth.",
      argument: "<fields>",
    },
    {
      flags: ["--deep"],
      description: "Comma-separated list of fields to flatten to arbitrary depth.",
      argument: "<fields>",
    },
    {
      flags: ["--separator"],
      description: "String used to separate joined field names. Default is '-'.",
      argument: "<string>",
    },
  ],
  examples: [
    {
      description: "Flatten a nested field one level deep",
      command: "recs flatten -k field",
      input: '{"field":{"subfield":"value"}}',
      output: '{"field-subfield":"value"}',
    },
    {
      description: "Flatten a deeply nested structure to arbitrary depth",
      command: "recs flatten --deep x",
      input: '{"x":{"y":[{"z":"v"}]}}',
      output: '{"x-y-0-z":"v"}',
    },
  ],
  seeAlso: ["xform", "stream2table"],
};
