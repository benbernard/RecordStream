import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { findKey } from "../../KeySpec.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * Normalize time fields to specified time bucket thresholds.
 * Supports epoch seconds and parseable date strings.
 *
 * Analogous to App::RecordStream::Operation::normalizetime in Perl.
 */
export class NormalizeTimeOperation extends Operation {
  extraArgs: string[] = [];
  key = "";
  sanitizedKey = "";
  threshold = 0;
  strict = false;
  epoch = false;
  priorNormalizedValue: number | null = null;

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { this.key = v as string; },
        description: "Key field containing the date/time value",
      },
      {
        long: "threshold",
        short: "n",
        type: "string",
        handler: (v) => {
          const str = v as string;
          if (/^[0-9.]+$/.test(str)) {
            this.threshold = parseFloat(str);
          } else {
            // Parse duration string - support common patterns
            this.threshold = parseDuration(str);
          }
        },
        description: "Number of seconds in each bucket, or a duration string",
      },
      {
        long: "strict",
        short: "s",
        type: "boolean",
        handler: () => { this.strict = true; },
        description: "Apply strict normalization",
      },
      {
        long: "epoch",
        short: "e",
        type: "boolean",
        handler: () => { this.epoch = true; },
        description: "Date/time field is expressed in epoch seconds",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (!this.key) {
      throw new Error("Must specify --key");
    }
    if (!this.threshold) {
      throw new Error("Must specify --threshold");
    }

    this.sanitizedKey = this.key.replace(/\//g, "_");
  }

  acceptRecord(record: Record): boolean {
    const data = record.dataRef() as JsonObject;
    const value = findKey(data, this.key, true);

    let time: number;
    if (this.epoch) {
      time = Number(value);
    } else {
      // Try to parse the date value as a Date object
      const parsed = new Date(String(value));
      if (isNaN(parsed.getTime())) {
        throw new Error(`Cannot parse date from key: ${this.key}, value: ${String(value)}`);
      }
      time = parsed.getTime() / 1000; // Convert to epoch seconds
    }

    const normalizedCurPeriod = Math.floor(time / this.threshold) * this.threshold;
    const normalizedPriorPeriod = normalizedCurPeriod - this.threshold;

    let normalizedTime: number;
    if (
      !this.strict &&
      this.priorNormalizedValue !== null &&
      this.priorNormalizedValue === normalizedPriorPeriod
    ) {
      normalizedTime = this.priorNormalizedValue;
    } else {
      normalizedTime = normalizedCurPeriod;
      this.priorNormalizedValue = normalizedCurPeriod;
    }

    record.set(`n_${this.sanitizedKey}`, normalizedTime);
    this.pushRecord(record);
    return true;
  }
}

/**
 * Parse a simple duration string into seconds.
 * Supports: "N seconds", "N minutes", "N hours", "N days", "N weeks"
 */
function parseDuration(str: string): number {
  const match = str.trim().match(/^(\d+(?:\.\d+)?)\s*(\w+)$/);
  if (!match) {
    throw new Error(`Cannot parse duration: '${str}'`);
  }

  const num = parseFloat(match[1]!);
  const unit = match[2]!.toLowerCase();

  const multipliers: { [unit: string]: number } = {
    s: 1, sec: 1, second: 1, seconds: 1,
    m: 60, min: 60, minute: 60, minutes: 60,
    h: 3600, hr: 3600, hour: 3600, hours: 3600,
    d: 86400, day: 86400, days: 86400,
    w: 604800, week: 604800, weeks: 604800,
  };

  const mult = multipliers[unit];
  if (mult === undefined) {
    throw new Error(`Unknown duration unit: '${unit}'`);
  }

  return num * mult;
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "normalizetime",
  category: "transform",
  synopsis: "recs normalizetime [options] [files...]",
  description:
    "Given a single key field containing a date/time value, construct a " +
    "normalized version of the value and place it into a field named " +
    "'n_<key>'. Used in conjunction with recs collate to aggregate " +
    "information over normalized time buckets.",
  options: [
    {
      flags: ["--key", "-k"],
      description: "Key field containing the date/time value. May be a key spec.",
      argument: "<key>",
      required: true,
    },
    {
      flags: ["--threshold", "-n"],
      description:
        "Number of seconds in each bucket. May also be a duration string " +
        "like '1 week' or '5 minutes'.",
      argument: "<time range>",
      required: true,
    },
    {
      flags: ["--epoch", "-e"],
      description:
        "Assumes the date/time field is expressed in epoch seconds " +
        "(optional, defaults to non-epoch).",
    },
    {
      flags: ["--strict", "-s"],
      description: "Apply strict normalization (defaults to non-strict).",
    },
  ],
  examples: [
    {
      description: "Tag records with normalized time in 5 minute buckets from the date field",
      command: "recs normalizetime --strict --key date -n 300",
    },
    {
      description:
        "Normalize time with fuzzy normalization into 1 minute buckets " +
        "from an epoch-relative time field",
      command: "recs normalizetime --key time -e -n 60",
    },
    {
      description: "Get 1 week buckets",
      command: "recs normalizetime --key timestamp -n '1 week'",
    },
  ],
  seeAlso: ["collate"],
};
