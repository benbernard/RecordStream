import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { findKey, setKey } from "../../KeySpec.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * Parse date/time strings and reformat them. Reads a date string from a key,
 * parses it, and writes the result (epoch seconds or formatted string) to an
 * output key.
 *
 * Inspired by the Perl PR #74 parsedate operation.
 */
export class ParseDateOperation extends Operation {
  extraArgs: string[] = [];
  inputKey = "";
  outputKey = "";
  inputFormat: string | null = null;
  outputFormat: string | null = null;
  epoch = false;
  outputEpoch = false;
  timezone: string | null = null;

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { this.inputKey = v as string; },
        description: "Key field containing the date/time string to parse",
      },
      {
        long: "output",
        short: "o",
        type: "string",
        handler: (v) => { this.outputKey = v as string; },
        description: "Output key for the parsed date (defaults to parsed_<key>)",
      },
      {
        long: "format",
        short: "f",
        type: "string",
        handler: (v) => { this.inputFormat = v as string; },
        description: "Input format for parsing (strftime-style: %Y-%m-%d %H:%M:%S)",
      },
      {
        long: "output-format",
        short: "F",
        type: "string",
        handler: (v) => { this.outputFormat = v as string; },
        description: "Output format (strftime-style: %Y-%m-%d %H:%M:%S). Default is ISO 8601.",
      },
      {
        long: "epoch",
        short: "e",
        type: "boolean",
        handler: () => { this.epoch = true; },
        description: "Input date is in epoch seconds",
      },
      {
        long: "output-epoch",
        short: "E",
        type: "boolean",
        handler: () => { this.outputEpoch = true; },
        description: "Output as epoch seconds instead of a formatted string",
      },
      {
        long: "timezone",
        short: "z",
        type: "string",
        handler: (v) => { this.timezone = v as string; },
        description: "Timezone for output (IANA name like America/New_York)",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (!this.inputKey) {
      throw new Error("Must specify --key");
    }
    if (!this.outputKey) {
      this.outputKey = `parsed_${this.inputKey.replace(/\//g, "_")}`;
    }
  }

  acceptRecord(record: Record): boolean {
    const data = record.dataRef() as JsonObject;
    const value = findKey(data, this.inputKey, true);

    if (value === undefined || value === null || value === "") {
      this.pushRecord(record);
      return true;
    }

    let date: Date;

    if (this.epoch) {
      date = new Date(Number(value) * 1000);
    } else if (this.inputFormat) {
      date = parseWithFormat(String(value), this.inputFormat);
    } else {
      // Try JavaScript's native date parsing
      date = new Date(String(value));
    }

    if (isNaN(date.getTime())) {
      throw new Error(`Cannot parse date from key '${this.inputKey}', value: ${String(value)}`);
    }

    let output: string | number;
    if (this.outputEpoch) {
      output = Math.floor(date.getTime() / 1000);
    } else if (this.outputFormat) {
      output = formatDate(date, this.outputFormat, this.timezone ?? undefined);
    } else {
      output = date.toISOString();
    }

    setKey(data, this.outputKey, output);
    this.pushRecord(record);
    return true;
  }
}

/**
 * Parse a date string given a strftime-style format.
 * Supports common directives: %Y, %m, %d, %H, %M, %S, %b, %B, %p, %Z, %z
 */
function parseWithFormat(input: string, format: string): Date {
  const monthNames: { [key: string]: number } = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
    apr: 3, april: 3, may: 4, jun: 5, june: 5,
    jul: 6, july: 6, aug: 7, august: 7, sep: 8, september: 8,
    oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
  };

  let year = 1970, month = 0, day = 1, hour = 0, minute = 0, second = 0;
  let isPM = false;

  // Build a regex from the format string
  let regexStr = "^";
  const captures: string[] = [];
  let i = 0;
  while (i < format.length) {
    if (format[i] === "%") {
      i++;
      const directive = format[i]!;
      switch (directive) {
        case "Y": regexStr += "(\\d{4})"; captures.push("Y"); break;
        case "y": regexStr += "(\\d{2})"; captures.push("y"); break;
        case "m": regexStr += "(\\d{1,2})"; captures.push("m"); break;
        case "d": regexStr += "(\\d{1,2})"; captures.push("d"); break;
        case "H": regexStr += "(\\d{1,2})"; captures.push("H"); break;
        case "I": regexStr += "(\\d{1,2})"; captures.push("I"); break;
        case "M": regexStr += "(\\d{1,2})"; captures.push("M"); break;
        case "S": regexStr += "(\\d{1,2})"; captures.push("S"); break;
        case "b": case "B":
          regexStr += "([A-Za-z]+)"; captures.push("b"); break;
        case "p": regexStr += "(AM|PM|am|pm)"; captures.push("p"); break;
        case "Z": regexStr += "(\\S+)"; captures.push("Z"); break;
        case "z": regexStr += "([+-]\\d{2}:?\\d{2})"; captures.push("z"); break;
        case "%": regexStr += "%"; break;
        default: regexStr += directive; break;
      }
    } else {
      regexStr += format[i]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    i++;
  }
  regexStr += "$";

  const match = input.match(new RegExp(regexStr));
  if (!match) {
    return new Date(NaN);
  }

  for (let j = 0; j < captures.length; j++) {
    const val = match[j + 1]!;
    switch (captures[j]) {
      case "Y": year = parseInt(val, 10); break;
      case "y": year = 2000 + parseInt(val, 10); break;
      case "m": month = parseInt(val, 10) - 1; break;
      case "d": day = parseInt(val, 10); break;
      case "H": hour = parseInt(val, 10); break;
      case "I": hour = parseInt(val, 10); break;
      case "M": minute = parseInt(val, 10); break;
      case "S": second = parseInt(val, 10); break;
      case "b": {
        const idx = monthNames[val.toLowerCase()];
        if (idx !== undefined) month = idx;
        break;
      }
      case "p": isPM = val.toLowerCase() === "pm"; break;
    }
  }

  if (isPM && hour < 12) hour += 12;
  if (!isPM && hour === 12 && captures.includes("p")) hour = 0;

  return new Date(year, month, day, hour, minute, second);
}

/**
 * Format a Date object using strftime-style directives.
 */
function formatDate(date: Date, format: string, timezone?: string): string {
  // Use Intl.DateTimeFormat for timezone conversion if needed
  let d = date;
  if (timezone) {
    // Create a new date adjusted for the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
    d = new Date(
      parseInt(get("year"), 10),
      parseInt(get("month"), 10) - 1,
      parseInt(get("day"), 10),
      parseInt(get("hour"), 10),
      parseInt(get("minute"), 10),
      parseInt(get("second"), 10),
    );
  }

  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonths = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let result = "";
  let i = 0;
  while (i < format.length) {
    if (format[i] === "%") {
      i++;
      const directive = format[i]!;
      switch (directive) {
        case "Y": result += pad(d.getFullYear(), 4); break;
        case "y": result += pad(d.getFullYear() % 100); break;
        case "m": result += pad(d.getMonth() + 1); break;
        case "d": result += pad(d.getDate()); break;
        case "H": result += pad(d.getHours()); break;
        case "I": result += pad(d.getHours() % 12 || 12); break;
        case "M": result += pad(d.getMinutes()); break;
        case "S": result += pad(d.getSeconds()); break;
        case "b": result += monthNames[d.getMonth()]; break;
        case "B": result += fullMonths[d.getMonth()]; break;
        case "a": result += dayNames[d.getDay()]; break;
        case "p": result += d.getHours() < 12 ? "AM" : "PM"; break;
        case "s": result += Math.floor(d.getTime() / 1000); break;
        case "%": result += "%"; break;
        default: result += "%" + directive; break;
      }
    } else {
      result += format[i];
    }
    i++;
  }
  return result;
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "parsedate",
  category: "transform",
  synopsis: "recs parsedate [options] [files...]",
  description:
    "Parse date/time strings from a field and output them in a normalized format. " +
    "Supports epoch seconds, ISO 8601, and custom strftime-style format strings for " +
    "both input and output.",
  options: [
    {
      flags: ["--key", "-k"],
      argument: "<key>",
      description: "Key field containing the date/time string to parse.",
      required: true,
    },
    {
      flags: ["--output", "-o"],
      argument: "<key>",
      description: "Output key for the parsed date (defaults to 'parsed_<key>').",
    },
    {
      flags: ["--format", "-f"],
      argument: "<format>",
      description:
        "Input format for parsing (strftime-style). Common directives: " +
        "%Y (4-digit year), %m (month), %d (day), %H (hour 24h), %M (minute), %S (second), " +
        "%b (abbreviated month name), %p (AM/PM).",
    },
    {
      flags: ["--output-format", "-F"],
      argument: "<format>",
      description:
        "Output format (strftime-style). Defaults to ISO 8601 if not specified.",
    },
    {
      flags: ["--epoch", "-e"],
      description: "Input date is in epoch seconds.",
    },
    {
      flags: ["--output-epoch", "-E"],
      description: "Output as epoch seconds instead of a formatted string.",
    },
    {
      flags: ["--timezone", "-z"],
      argument: "<timezone>",
      description:
        "Timezone for output formatting (IANA name like 'America/New_York').",
    },
  ],
  examples: [
    {
      description: "Parse dates and output as epoch seconds",
      command: "recs parsedate -k date -E",
    },
    {
      description: "Parse a custom date format and reformat it",
      command: "recs parsedate -k timestamp -f '%d/%b/%Y:%H:%M:%S' -F '%Y-%m-%d %H:%M:%S'",
    },
    {
      description: "Convert epoch seconds to ISO 8601",
      command: "recs parsedate -k time -e -o iso_time",
    },
  ],
  seeAlso: ["normalizetime"],
};
