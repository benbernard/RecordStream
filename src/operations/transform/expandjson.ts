import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { findKey, setKey } from "../../KeySpec.ts";
import type { JsonValue, JsonObject } from "../../types/json.ts";
import type { CommandDoc } from "../../types/CommandDoc.ts";

/**
 * Expand JSON strings embedded in record fields into actual JSON values.
 *
 * Analogous to App::RecordStream::Operation::expandjson (new operation).
 */
export class ExpandJsonOperation extends Operation {
  keys: string[] = [];
  recursive = false;

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { this.keys.push(v as string); },
        description: "Key(s) containing JSON strings to expand. May be specified multiple times.",
      },
      {
        long: "recursive",
        short: "r",
        type: "boolean",
        handler: () => { this.recursive = true; },
        description: "Recursively expand JSON strings found in nested values after initial expansion.",
      },
    ];

    this.parseOptions(args, defs);
  }

  acceptRecord(record: Record): boolean {
    const data = record.dataRef() as JsonObject;

    if (this.keys.length === 0) {
      this.expandAllFields(data);
    } else {
      for (const key of this.keys) {
        const value = findKey(data, key, true);
        if (typeof value === "string") {
          const expanded = this.tryParseJson(value);
          if (expanded !== undefined) {
            setKey(data, key, this.recursive ? this.recursiveExpand(expanded) : expanded);
          }
        }
      }
    }

    this.pushRecord(record);
    return true;
  }

  tryParseJson(str: string): JsonValue | undefined {
    const trimmed = str.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        trimmed === "true" || trimmed === "false" || trimmed === "null" ||
        (trimmed.startsWith("\"") && trimmed.endsWith("\""))) {
      try {
        return JSON.parse(trimmed) as JsonValue;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  recursiveExpand(value: JsonValue): JsonValue {
    if (typeof value === "string") {
      const expanded = this.tryParseJson(value);
      if (expanded !== undefined) {
        return this.recursiveExpand(expanded);
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.recursiveExpand(item));
    }
    if (value !== null && typeof value === "object") {
      const result: JsonObject = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.recursiveExpand(v as JsonValue);
      }
      return result;
    }
    return value;
  }

  expandAllFields(data: JsonObject): void {
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (typeof value === "string") {
        const expanded = this.tryParseJson(value);
        if (expanded !== undefined) {
          data[key] = this.recursive ? this.recursiveExpand(expanded) : expanded;
        }
      }
    }
  }
}

export const documentation: CommandDoc = {
  name: "expandjson",
  category: "transform",
  synopsis: "recs expandjson [options] [files...]",
  description:
    "Expand JSON strings embedded in record fields into actual JSON values. " +
    "When a field contains a string that is valid JSON (object, array, etc.), " +
    "this operation parses it and replaces the string with the parsed structure. " +
    "With no --key options, all top-level string fields that look like JSON are expanded.",
  options: [
    {
      flags: ["--key", "-k"],
      description:
        "Key containing a JSON string to expand. May be a keyspec. " +
        "May be specified multiple times for multiple keys.",
      argument: "<key>",
    },
    {
      flags: ["--recursive", "-r"],
      description:
        "Recursively expand JSON strings found in nested values after initial expansion.",
    },
  ],
  examples: [
    {
      description: "Expand a metadata field containing a JSON string",
      command: "recs expandjson --key metadata",
      input: '{"name":"alice","metadata":"{\\"role\\":\\"admin\\",\\"level\\":3}"}',
      output: '{"name":"alice","metadata":{"role":"admin","level":3}}',
    },
    {
      description: "Recursively expand nested JSON strings",
      command: "recs expandjson -r --key payload",
    },
    {
      description: "Expand all JSON-like string fields automatically",
      command: "recs expandjson",
    },
  ],
  seeAlso: ["flatten", "eval"],
};
