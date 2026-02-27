import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { findKey } from "../../KeySpec.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";
import * as chrono from "chrono-node";

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

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
    this.addCustomHelpType(
      "full",
      normalizeTimeFullHelp,
      "In-depth description of the normalization algorithm",
    );
  }

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
      const dateStr = String(value);
      // Try native Date first (handles ISO 8601, RFC 2822, etc.)
      let parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        // Fall back to chrono-node for natural language and non-standard formats
        const chronoParsed = chrono.parseDate(dateStr);
        if (!chronoParsed) {
          throw new Error(`Cannot parse date from key: ${this.key}, value: ${dateStr}`);
        }
        parsed = chronoParsed;
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

const DURATION_MULTIPLIERS: { [unit: string]: number } = {
  s: 1, sec: 1, second: 1, seconds: 1,
  m: 60, min: 60, minute: 60, minutes: 60,
  h: 3600, hr: 3600, hour: 3600, hours: 3600,
  d: 86400, day: 86400, days: 86400,
  w: 604800, week: 604800, weeks: 604800,
};

/**
 * Parse a duration string into seconds.
 * Supports single-unit ("5 minutes") and multi-unit ("3 days 2 hours 30 minutes").
 */
function parseDuration(str: string): number {
  const trimmed = str.trim();

  // Match all "number unit" pairs in the string
  const pattern = /(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g;
  let match: RegExpExecArray | null;
  let totalSeconds = 0;
  let matchCount = 0;

  while ((match = pattern.exec(trimmed)) !== null) {
    matchCount++;
    const num = parseFloat(match[1]!);
    const unit = match[2]!.toLowerCase();

    const mult = DURATION_MULTIPLIERS[unit];
    if (mult === undefined) {
      throw new Error(`Unknown duration unit: '${unit}'`);
    }

    totalSeconds += num * mult;
  }

  if (matchCount === 0) {
    throw new Error(`Cannot parse duration: '${str}'`);
  }

  return totalSeconds;
}

function normalizeTimeFullHelp(): string {
  return `NORMALIZETIME FULL HELP:

OVERVIEW:
  Normalizetime takes a time field (either epoch seconds or a parseable date
  string) and rounds it down to a time bucket boundary. The result is stored
  in a new field named "n_<key>" (with "/" replaced by "_" in nested keys).

  This is typically used as a preprocessing step before recs collate, to
  aggregate data into time-based buckets (e.g. per-minute, per-hour counts).

THE NORMALIZATION ALGORITHM:
  The algorithm has two modes: strict and non-strict (fuzzy).

  Strict mode (--strict):
    Each time value is independently rounded down to the nearest threshold
    boundary:
      normalized = floor(time / threshold) * threshold

    Example with threshold=300 (5 minutes):
      time=1000 -> normalized=900   (bucket [900, 1200))
      time=1100 -> normalized=900   (bucket [900, 1200))
      time=1200 -> normalized=1200  (bucket [1200, 1500))

  Non-strict mode (default):
    Non-strict mode extends the previous bucket to absorb values that fall
    in the immediately following bucket. This "fuzzy" behavior helps when
    events are slightly outside a boundary but logically belong to the
    prior group.

    The algorithm works as follows for each time value:
      1. Compute normalizedCurPeriod = floor(time / threshold) * threshold
      2. Compute normalizedPriorPeriod = normalizedCurPeriod - threshold
      3. If the PRIOR record's normalized value equals normalizedPriorPeriod,
         reuse the prior normalized value instead of normalizedCurPeriod.
      4. Otherwise, use normalizedCurPeriod.

    In other words, if a value falls in the next bucket but the previous
    record was in the immediately preceding bucket, the current value is
    pulled back into the previous bucket.

    Example with threshold=300 (5 minutes):
      time=1000 -> normalized=900   (first record, starts bucket 900)
      time=1100 -> normalized=900   (same bucket)
      time=1200 -> normalized=900   (would be 1200, but prior was 900 = 1200-300, so stays 900)
      time=1500 -> normalized=1500  (1500-300=1200 != prior 900, so new bucket)

    This is useful when timestamps drift slightly across bucket boundaries
    but represent the same logical event group.

TIME INPUT:
  --epoch (-e): The key field contains epoch seconds (numeric).
  Without --epoch: The key field is parsed as a date string using
  JavaScript's Date constructor (supports ISO 8601, RFC 2822, etc.).

THRESHOLD:
  The threshold can be a plain number (seconds) or a duration string:
    300, "5 minutes", "1 hour", "1 day", "1 week"

  Multi-unit durations are also supported:
    "3 days 2 hours", "1 hour 30 minutes", "2d 12h"

  Supported units: s/sec/second/seconds, m/min/minute/minutes,
  h/hr/hour/hours, d/day/days, w/week/weeks

COMMON PATTERNS:
  Aggregate by 5-minute windows:
    recs normalizetime -k timestamp -n 300 --strict \\
      | recs collate -k n_timestamp -a count

  Hourly summaries with fuzzy bucketing:
    recs normalizetime -k time -e -n 3600 \\
      | recs collate -k n_time -a avg,latency

  Daily rollups:
    recs normalizetime -k date -n '1 day' --strict \\
      | recs collate -k n_date -a sum,revenue
`;
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
        "like '1 week', '5 minutes', or '3 days 2 hours'.",
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
