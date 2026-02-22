import { Operation } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * Apache combined/common log format regex patterns.
 */

// Combined log format:
// host ident authuser [date] "request" status bytes "referer" "agent"
const COMBINED_RE =
  /^(\S+) (\S+) (\S+) \[(\d{2}\/\w{3}\/\d{4}):(\d{2}:\d{2}:\d{2}) ([^\]]+)\] "([^"]*(?:\\"[^"]*)*)" (\d{3}|-) (\d+|-) "([^"]*(?:\\"[^"]*)*)" "([^"]*(?:\\"[^"]*)*)"/;

// Common log format:
// host ident authuser [date] "request" status bytes
const COMMON_RE =
  /^(\S+) (\S+) (\S+) \[(\d{2}\/\w{3}\/\d{4}):(\d{2}:\d{2}:\d{2}) ([^\]]+)\] "([^"]*(?:\\"[^"]*)*)" (\d{3}|-) (\d+|-)/;

// vhost_common log format:
// vhost host ident authuser [date] "request" status bytes
const VHOST_COMMON_RE =
  /^(\S+) (\S+) (\S+) (\S+) \[(\d{2}\/\w{3}\/\d{4}):(\d{2}:\d{2}:\d{2}) ([^\]]+)\] "([^"]*(?:\\"[^"]*)*)" (\d{3}|-) (\d+|-)/;

type ParseMode = "fast" | "strict";

/**
 * Parse Apache access log lines into records.
 *
 * Analogous to App::RecordStream::Operation::fromapache in Perl.
 */
export class FromApache extends Operation {
  mode: ParseMode = "fast";
  strictFormats: string[] | null = null;

  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(args: string[]): void {
    let fastSet = false;
    let strictSet = false;
    let fastArg: string | null = null;
    let strictArg: string | null = null;

    // Manually handle --fast and --strict since they can take optional values
    // The base parser treats them as string type
    const remaining: string[] = [];
    let i = 0;
    while (i < args.length) {
      const arg = args[i]!;
      if (arg === "--fast") {
        fastSet = true;
        // Check if next arg looks like a value (not a flag)
        if (i + 1 < args.length && !args[i + 1]!.startsWith("--")) {
          fastArg = args[i + 1]!;
          i += 2;
        } else {
          i++;
        }
      } else if (arg.startsWith("--fast=")) {
        fastSet = true;
        fastArg = arg.slice(7);
        i++;
      } else if (arg === "--strict") {
        strictSet = true;
        if (i + 1 < args.length && !args[i + 1]!.startsWith("--")) {
          strictArg = args[i + 1]!;
          i += 2;
        } else {
          i++;
        }
      } else if (arg.startsWith("--strict=")) {
        strictSet = true;
        strictArg = arg.slice(9);
        i++;
      } else if (arg === "--verbose") {
        i++;
      } else if (arg === "--help" || arg === "-h") {
        this.setWantsHelp(true);
        i++;
      } else {
        remaining.push(arg);
        i++;
      }
    }

    // Handle "0" values for fast/strict
    if (fastArg === "0") {
      fastSet = false;
    }
    if (strictArg === "0") {
      strictSet = false;
    }

    if (fastSet && strictSet) {
      throw new Error(
        "only one option from 'strict' or 'fast' required"
      );
    }

    if (strictSet) {
      this.mode = "strict";
      if (strictArg && strictArg !== "1") {
        // Parse format list like '["combined","common"]'
        try {
          const parsed: unknown = JSON.parse(strictArg);
          if (Array.isArray(parsed)) {
            this.strictFormats = parsed as string[];
          }
        } catch {
          throw new Error(`eval of option strict failed. syntax error at ${strictArg}`);
        }
      }
    } else {
      this.mode = "fast";
      if (fastArg && fastArg !== "1") {
        try {
          JSON.parse(fastArg);
        } catch {
          throw new Error(`eval of option fast failed. syntax error at ${fastArg}`);
        }
      }
    }
  }

  processLine(line: string): void {
    const record = this.parseLine(line);
    if (record) {
      this.pushRecord(record);
    }
  }

  override acceptLine(line: string): boolean {
    this.processLine(line);
    return true;
  }

  parseLine(line: string): Record | null {
    if (this.mode === "strict" && this.strictFormats) {
      // Try only the specified formats
      for (const format of this.strictFormats) {
        const result = this.tryFormat(format, line);
        if (result) return result;
      }
      return null;
    }

    if (this.mode === "strict") {
      return this.parseStrict(line);
    }

    return this.parseFast(line);
  }

  tryFormat(format: string, line: string): Record | null {
    if (format === "vhost_common") {
      return this.parseVhostCommon(line);
    }
    if (format === "common") {
      return this.parseCommon(line);
    }
    if (format === "combined") {
      return this.parseCombined(line);
    }
    return null;
  }

  parseFast(line: string): Record | null {
    return this.parseCombined(line) ?? this.parseCommon(line);
  }

  parseStrict(line: string): Record | null {
    return this.parseCombined(line) ?? this.parseCommon(line) ?? this.parseVhostCommon(line);
  }

  parseCombined(line: string): Record | null {
    const m = COMBINED_RE.exec(line);
    if (!m) return null;

    const request = m[7]!;
    const { method, path, proto } = parseRequest(request, this.mode === "strict");

    const data: JsonObject = {
      rhost: m[1]!,
      logname: m[2]!,
      user: m[3]!,
      date: m[4]!,
      time: m[5]!,
      timezone: m[6]!,
      datetime: `${m[4]!}:${m[5]!} ${m[6]!}`,
      request: request,
      method: method,
      path: path,
      status: m[8]!,
      bytes: m[9]!,
      referer: m[10]!,
      agent: m[11]!,
    };

    if (proto) {
      data["proto"] = proto;
    }

    return new Record(data);
  }

  parseCommon(line: string): Record | null {
    const m = COMMON_RE.exec(line);
    if (!m) return null;

    const request = m[7]!;
    const { method, path, proto } = parseRequest(request, this.mode === "strict");

    const data: JsonObject = {
      rhost: m[1]!,
      logname: m[2]!,
      user: m[3]!,
      date: m[4]!,
      time: m[5]!,
      timezone: m[6]!,
      datetime: `${m[4]!}:${m[5]!} ${m[6]!}`,
      request: request,
      method: method,
      path: path,
      status: m[8]!,
      bytes: m[9]!,
    };

    if (proto) {
      data["proto"] = proto;
    }

    return new Record(data);
  }

  parseVhostCommon(line: string): Record | null {
    const m = VHOST_COMMON_RE.exec(line);
    if (!m) return null;

    const request = m[8]!;
    const { method, path, proto } = parseRequest(request, this.mode === "strict");

    const data: JsonObject = {
      vhost: m[1]!,
      rhost: m[2]!,
      logname: m[3]!,
      user: m[4]!,
      date: m[5]!,
      time: m[6]!,
      timezone: m[7]!,
      datetime: `${m[5]!}:${m[6]!} ${m[7]!}`,
      request: request,
      method: method,
      path: path,
      status: m[9]!,
      bytes: m[10]!,
    };

    if (proto) {
      data["proto"] = proto;
    }

    return new Record(data);
  }
}

function parseRequest(
  request: string,
  _strict: boolean
): { method: string; path: string; proto: string | null } {
  const parts = request.split(" ");
  const method = parts[0] ?? "";

  if (parts.length >= 3) {
    const proto = parts[parts.length - 1]!;
    // In strict mode, the path retains escaped quotes from the raw request
    const pathParts = parts.slice(1, -1);
    const path = pathParts.join(" ");
    return { method, path, proto };
  }

  const path = parts.slice(1).join(" ");
  return { method, path, proto: null };
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromapache",
  category: "input",
  synopsis: "recs fromapache [options] [files...]",
  description:
    "Each line of input (or lines of <files>) is parsed to produce an output record from Apache access logs. Supports combined, common, and vhost_common log formats.",
  options: [
    {
      flags: ["--fast"],
      description:
        "Use the fast parser which works relatively fast. It can process only 'common', 'combined' and custom styles with compatibility with 'common', and cannot work with backslash-quoted double-quotes in fields. This is the default.",
    },
    {
      flags: ["--strict"],
      description:
        "Use the strict parser which works relatively slow. It can process any style format logs, with specification about separator, and checker for perfection. It can also process backslash-quoted double-quotes properly.",
    },
    {
      flags: ["--verbose"],
      description: "Verbose output.",
    },
  ],
  examples: [
    {
      description: "Get records from typical apache log",
      command: "recs fromapache < /var/log/httpd-access.log",
    },
    {
      description: "Use strict parser with specific formats",
      command:
        'recs fromapache --strict \'["combined","common","vhost_common"]\' < /var/log/httpd-access.log',
    },
  ],
  seeAlso: ["fromre", "frommultire"],
};
