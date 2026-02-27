import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey } from "../../KeySpec.ts";
import type { JsonValue, JsonObject, JsonArray } from "../../types/json.ts";

/**
 * Pretty print records, one key to a line, with a line of dashes
 * separating records.
 *
 * Analogous to App::RecordStream::Operation::toprettyprint in Perl.
 */
export class ToPrettyPrint extends Operation {
  limit: number | null = null;
  keyGroups = new KeyGroups();
  nestedOutput = true;
  aligned: "left" | "right" | null = null;
  formatKeyWidth = 0;

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
        long: "1",
        type: "boolean",
        handler: () => { this.limit = 1; },
        description: "Only print the first record",
      },
      {
        long: "one",
        type: "boolean",
        handler: () => { this.limit = 1; },
        description: "Only print the first record",
      },
      {
        long: "n",
        type: "string",
        handler: (v) => { this.limit = parseInt(v as string, 10); },
        description: "Only print n records",
      },
      {
        long: "keys",
        short: "k",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Only print out specified keys",
      },
      {
        long: "nonested",
        type: "boolean",
        handler: () => { this.nestedOutput = false; },
        description: "Do not nest the output of hashes",
      },
      {
        long: "aligned",
        type: "string",
        handler: (v) => {
          const val = (v as string).toLowerCase();
          this.aligned = val.startsWith("l") ? "left" : "right";
        },
        description: "Format keys to the same width",
      },
    ];

    this.parseOptions(args, defs);

    if (!this.keyGroups.hasAnyGroup()) {
      // Default: all keys, returning refs, sorted implicitly by caller
      this.keyGroups.addGroups("!.!rr");
    }
  }

  acceptRecord(record: Record): boolean {
    if (this.limit !== null) {
      if (this.limit === 0) {
        return false;
      }
      this.limit--;
    }

    const data = record.dataRef();
    const specs = this.keyGroups.getKeyspecsForRecord(data);

    if (this.aligned) {
      for (const key of specs) {
        const width = key.length;
        if (width > this.formatKeyWidth) {
          this.formatKeyWidth = width;
        }
      }
    }

    this.pushLine("-".repeat(70));
    const sortedSpecs = [...specs].sort();
    for (const key of sortedSpecs) {
      const value = findKey(data, key, true);
      this.outputValue("", key, value);
    }

    return true;
  }

  formatKey(key: string): string {
    if (!this.formatKeyWidth) return key;
    const width = this.aligned === "left" ? -this.formatKeyWidth : this.formatKeyWidth;
    if (width > 0) {
      return key.padStart(width);
    }
    return key.padEnd(-width);
  }

  outputValue(prefix: string, key: string | number, value: JsonValue | undefined): void {
    const formattedKey = typeof key === "string" ? this.formatKey(key) : String(key);

    if (typeof value === "object" && value !== null && !Array.isArray(value) && this.nestedOutput) {
      const hash = value as JsonObject;
      const keys = Object.keys(hash);
      if (keys.length > 0) {
        this.pushLine(prefix + formattedKey + " = HASH:");
        this.outputHash(prefix + "   ", hash);
      } else {
        this.pushLine(prefix + formattedKey + " = EMPTY HASH");
      }
    } else if (Array.isArray(value) && this.nestedOutput) {
      const arr = value as JsonArray;
      if (arr.length > 0) {
        this.pushLine(prefix + formattedKey + " = ARRAY:");
        this.outputArray(prefix + "   ", arr);
      } else {
        this.pushLine(prefix + formattedKey + " = EMPTY ARRAY");
      }
    } else {
      const valueString = formatValue(value);
      this.pushLine(prefix + formattedKey + " = " + valueString);
    }
  }

  outputArray(prefix: string, array: JsonArray): void {
    // Perl sorts array elements using string comparison.
    // Perl stringifies hash refs as HASH(0x...) and array refs as ARRAY(0x...).
    // We emulate this: objects sort as "HASH(...)", arrays as "ARRAY(...)", others as their string value.
    const sorted = [...array].sort((a, b) => {
      const sa = perlSortKey(a);
      const sb = perlSortKey(b);
      if (sa < sb) return -1;
      if (sa > sb) return 1;
      return 0;
    });

    let index = 0;
    for (const value of sorted) {
      this.outputValue(prefix, index, value);
      index++;
    }
  }

  outputHash(prefix: string, hash: JsonObject): void {
    const sortedKeys = Object.keys(hash).sort();
    for (const key of sortedKeys) {
      this.outputValue(prefix, key, hash[key]!);
    }
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs toprettyprint [files]
   Pretty print records, one key to a line, with a line of dashes (---)
   separating records.

Arguments:
  --1|--one          Only print the first record
  --keys|-k          Only print out specified keys
  --nonested         Do not nest the output of hashes
  --n <n>            Only print n records
  --aligned [r|l]    Format keys to the same width

Examples
  # Pretty print records
  recs toprettyprint

  # Find all keys with 'time' in the name or value
  ... | recs toprettyprint --one | grep time`;
  }
}

/**
 * Format a value for pretty printing, matching Perl's hashref_string behavior.
 */
function formatValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return "undef";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Generate a sort key matching Perl's stringification for sort comparison.
 * In Perl, hash refs stringify as "HASH(0x...)" and array refs as "ARRAY(0x...)".
 * Strings/numbers stringify as themselves.
 */
function perlSortKey(value: JsonValue): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return "ARRAY(...)";
  if (typeof value === "object") return "HASH(...)";
  return String(value);
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "toprettyprint",
  category: "output",
  synopsis: "recs toprettyprint [options] [files...]",
  description:
    "Pretty print records, one key to a line, with a line of dashes separating records. Especially useful for records with very large amounts of keys.",
  options: [
    {
      flags: ["--1", "--one"],
      description: "Only print the first record.",
    },
    {
      flags: ["--n"],
      argument: "<n>",
      description: "Only print n records.",
    },
    {
      flags: ["--keys", "-k"],
      argument: "<keys>",
      description:
        "Only print out specified keys. May be keyspecs or keygroups.",
    },
    {
      flags: ["--nonested"],
      description:
        "Do not nest the output of hashes, keep each value on one line.",
    },
    {
      flags: ["--aligned"],
      argument: "[r|l|right|left]",
      description:
        "Format keys to the same width so values are aligned. Keys are right aligned by default, but you may pass a value of 'left' to left align keys within the width.",
    },
  ],
  examples: [
    {
      description: "Pretty print records",
      command: "recs toprettyprint",
    },
    {
      description: "Find all keys with 'time' in the name or value",
      command: "... | recs toprettyprint --one | grep time",
    },
  ],
  seeAlso: ["totable", "tohtml"],
};
