import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Operation, CollectorReceiver } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import type { ClumperCallback } from "../../Clumper.ts";
import { ClumperOptions } from "../../clumpers/Options.ts";
import { Record } from "../../Record.ts";
import { createOperation } from "./chain.ts";
import { findKey } from "../../KeySpec.ts";
import { snippetValuation } from "../../DomainLanguage.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * ClumperCallback for multiplex: creates a separate operation instance
 * for each group of records.
 */
class MultiplexClumperCallback implements ClumperCallback {
  operationName: string;
  operationArgs: string[];
  lineKey: string | null;
  outputFileKey: string | null;
  outputFileEval: string | null;
  pushRecordCb: (record: Record) => boolean;
  pushLineCb: (line: string) => void;
  initializedFiles = new Set<string>();

  constructor(
    operationName: string,
    operationArgs: string[],
    lineKey: string | null,
    outputFileKey: string | null,
    outputFileEval: string | null,
    pushRecordCb: (record: Record) => boolean,
    pushLineCb: (line: string) => void
  ) {
    this.operationName = operationName;
    this.operationArgs = operationArgs;
    this.lineKey = lineKey;
    this.outputFileKey = outputFileKey;
    this.outputFileEval = outputFileEval;
    this.pushRecordCb = pushRecordCb;
    this.pushLineCb = pushLineCb;
  }

  resolveOutputFile(options: { [key: string]: unknown }): string | null {
    if (this.outputFileKey) {
      const val = options[this.outputFileKey];
      if (val !== undefined && val !== null) {
        return String(val);
      }
      return null;
    }
    if (this.outputFileEval) {
      // Replace {{key}} placeholders with group values
      let filename = this.outputFileEval;
      for (const [key, val] of Object.entries(options)) {
        filename = filename.replace(
          new RegExp(`\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}\\}`, "g"),
          String(val ?? "")
        );
      }
      return filename;
    }
    return null;
  }

  clumperCallbackBegin(options: { [key: string]: unknown }): unknown {
    const collector = new CollectorReceiver();
    const op = createOperation(this.operationName, [...this.operationArgs], collector);
    const outputFile = this.resolveOutputFile(options);
    return { operation: op, collector, outputFile };
  }

  clumperCallbackPushRecord(cookie: unknown, record: Record): void {
    const state = cookie as { operation: Operation; collector: CollectorReceiver; outputFile: string | null };

    if (this.lineKey) {
      const data = record.dataRef() as JsonObject;
      const lineValue = findKey(data, this.lineKey, true);
      if (lineValue !== undefined && lineValue !== null) {
        state.operation.acceptLine(String(lineValue));
      }
    } else {
      state.operation.acceptRecord(record);
    }
  }

  clumperCallbackEnd(cookie: unknown): void {
    const state = cookie as { operation: Operation; collector: CollectorReceiver; outputFile: string | null };
    state.operation.finish();

    if (state.outputFile) {
      // Write output to file
      const dir = dirname(state.outputFile);
      if (dir && dir !== "." && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Initialize file (truncate) on first write, then append
      if (!this.initializedFiles.has(state.outputFile)) {
        writeFileSync(state.outputFile, "");
        this.initializedFiles.add(state.outputFile);
      }

      // Write collected lines (from output operations like tocsv)
      for (const line of state.collector.lines) {
        appendFileSync(state.outputFile, line + "\n");
      }

      // Write collected records (from transform operations)
      for (const record of state.collector.records) {
        appendFileSync(state.outputFile, record.toString() + "\n");
      }
    } else {
      // Push lines to downstream
      for (const line of state.collector.lines) {
        this.pushLineCb(line);
      }
      // Push records to downstream
      for (const record of state.collector.records) {
        this.pushRecordCb(record);
      }
    }
  }
}

/**
 * Run multiple operations on the same stream, grouped by key.
 * Each group gets its own operation instance.
 *
 * Analogous to App::RecordStream::Operation::multiplex in Perl.
 */
export class MultiplexOperation extends Operation {
  clumperOptions!: ClumperOptions;

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
    this.useHelpType("keygroups");
    this.useHelpType("keys");
    this.useHelpType("domainlanguage");
    this.useHelpType("clumping");
    this.addCustomHelpType(
      "more",
      multiplexMoreHelp,
      "Larger help documentation for multiplex",
    );
  }

  init(args: string[]): void {
    const clumperOptions = new ClumperOptions();
    let lineKey: string | null = null;
    let outputFileKey: string | null = null;
    let outputFileEval: string | null = null;

    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { clumperOptions.addKey(v as string); },
        description: "Key fields for grouping",
      },
      {
        long: "dlkey",
        short: "K",
        type: "string",
        handler: (v) => {
          const str = v as string;
          const eqIdx = str.indexOf("=");
          if (eqIdx < 0) {
            throw new Error(`Bad domain language key option (missing '=' to separate name and code): ${str}`);
          }
          const name = str.slice(0, eqIdx);
          const code = str.slice(eqIdx + 1);
          void snippetValuation(code);
          clumperOptions.addKey(name);
        },
        description: "Domain language key (name=expression evaluating to a valuation)",
      },
      {
        long: "line-key",
        short: "L",
        type: "string",
        handler: (v) => { lineKey = v as string; },
        description: "Use this key's value as line input for the nested operation",
      },
      {
        long: "output-file-key",
        short: "o",
        type: "string",
        handler: (v) => { outputFileKey = v as string; },
        description: "Write each group's output to a file named by the value of this key field",
      },
      {
        long: "output-file-eval",
        short: "O",
        type: "string",
        handler: (v) => { outputFileEval = v as string; },
        description: "Write each group's output to a filename derived from the given expression (supports {{key}} interpolation)",
      },
      {
        long: "adjacent",
        short: "1",
        type: "boolean",
        handler: () => { clumperOptions.setKeySize(1); },
        description: "Only group adjacent records",
      },
      {
        long: "size",
        short: "n",
        type: "number",
        handler: (v) => { clumperOptions.setKeySize(Number(v)); },
        description: "Number of running clumps to keep",
      },
      {
        long: "sz",
        type: "number",
        handler: (v) => { clumperOptions.setKeySize(Number(v)); },
        description: "Alias for --size",
      },
      {
        long: "cube",
        type: "boolean",
        handler: () => { clumperOptions.setCube(true); },
        description: "Enable cube mode",
      },
      {
        long: "clumper",
        short: "c",
        type: "string",
        handler: (v) => { clumperOptions.addClumper(v as string); },
        description: "Clumper specification (e.g. keylru,field,size or keyperfect,field)",
      },
      {
        long: "dlclumper",
        type: "string",
        handler: (v) => { clumperOptions.addClumper(v as string); },
        description: "Domain language clumper specification",
      },
      {
        long: "list-clumpers",
        type: "boolean",
        handler: () => { clumperOptions.setHelpList(true); },
        description: "List available clumpers and exit",
      },
      {
        long: "show-clumper",
        type: "string",
        handler: (v) => { clumperOptions.setHelpShow(v as string); },
        description: "Show details of a specific clumper and exit",
      },
    ];

    const remaining = this.parseOptions(args, defs);

    // Parse the operation specification from remaining args.
    // Format: <operation-name> [operation-args...]
    if (remaining.length === 0) {
      throw new Error("multiplex requires an operation to run on each group (after --)");
    }

    const operationName = remaining[0]!;
    const operationArgs = remaining.slice(1);

    const callback = new MultiplexClumperCallback(
      operationName,
      operationArgs,
      lineKey,
      outputFileKey,
      outputFileEval,
      (record: Record) => this.pushRecord(record),
      (line: string) => this.pushLine(line)
    );

    clumperOptions.checkOptions(callback);
    this.clumperOptions = clumperOptions;
  }

  acceptRecord(record: Record): boolean {
    this.clumperOptions.acceptRecord(record);
    return true;
  }

  override streamDone(): void {
    this.clumperOptions.streamDone();
  }
}

function multiplexMoreHelp(): string {
  return `MULTIPLEX EXTENDED HELP:

Multiplex runs a separate instance of a recs operation for each group of
records defined by --key. Think of it as "collate but for arbitrary
operations" -- where collate aggregates, multiplex delegates.

HOW IT WORKS:
  1. Records arrive and are grouped by --key (using clumper options).
  2. For each group, a fresh instance of the specified operation is created.
  3. Records are fed to the operation instance for their group.
  4. When the group is flushed (stream end or LRU eviction), the operation
     instance is finished and its output is collected.

SPECIFYING THE OPERATION:
  The operation and its arguments come after "--" on the command line:

    recs multiplex -k host -- recs collate -a count

  Everything after "--" is passed as the operation specification. The first
  word is the operation name (e.g. "collate", "sort", "xform"), and the
  rest are its arguments.

LINE KEY MODE:
  With --line-key (-L), instead of feeding whole records to the nested
  operation, the value of the specified key is fed as a raw line. This is
  useful when your records contain text that should be parsed by a recs
  from* operation:

    recs multiplex -k pid -L line -- recs fromre '(\d+) (\w+)'

OUTPUT TO FILES:
  Use --output-file-key (-o) to write each group's output to a separate
  file named by the value of a key field:

    recs multiplex -k department -o department -- recs tocsv

  Use --output-file-eval (-O) for templated filenames with {{key}}
  interpolation:

    recs multiplex -k host,date -O 'logs/{{host}}/{{date}}.json' -- recs sort -k timestamp

CLUMPING OPTIONS:
  Multiplex supports the same clumping options as collate:
    --adjacent (-1)   Only group adjacent records (memory-efficient)
    --size (-n)       Limit number of active groups (LRU eviction)
    --cube            Generate all key combinations
    --clumper (-c)    Custom clumper specification

COMMON PATTERNS:
  Per-group sorting:
    recs multiplex -k category -- recs sort -k timestamp

  Per-group numbering:
    recs multiplex -k thread -- recs eval 'r.nbr = ++nbr'

  Split text streams by key:
    recs multiplex -L line -k pid -- recs frommultire ...

  Write per-group CSV files:
    recs multiplex -k dept -O 'output-{{dept}}.csv' -- recs tocsv
`;
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "multiplex",
  category: "transform",
  synopsis: "recs multiplex [options] -- <other recs operation>",
  description:
    "Take records, grouped together by --keys, and run a separate operation " +
    "instance for each group. Each group gets its own operation instance.",
  options: [
    {
      flags: ["--key", "-k"],
      description: "Comma-separated list of key fields for grouping. May be a key spec or key group.",
      argument: "<keys>",
    },
    {
      flags: ["--dlkey", "-K"],
      description: "Domain language key: name=expression where the expression evaluates as a valuation.",
      argument: "<name>=<expression>",
    },
    {
      flags: ["--line-key", "-L"],
      description:
        "Use the value of this key as line input for the nested operation " +
        "(rather than the entire record). Use with recs from* operations generally.",
      argument: "<key>",
    },
    {
      flags: ["--output-file-key", "-o"],
      description:
        "Write each group's output to a separate file, using the value of the given key as the filename.",
      argument: "<key>",
    },
    {
      flags: ["--output-file-eval", "-O"],
      description:
        "Write each group's output to a separate file, with filename determined by the given expression. " +
        "Supports {{key}} interpolation with group key values.",
      argument: "<expression>",
    },
    {
      flags: ["--adjacent", "-1"],
      description: "Only group together adjacent records. Avoids spooling records into memory.",
    },
    {
      flags: ["--size", "--sz", "-n"],
      description: "Number of running clumps to keep.",
      argument: "<number>",
    },
    {
      flags: ["--cube"],
      description: "Enable cube mode.",
    },
    {
      flags: ["--clumper", "-c"],
      description: "Clumper specification (e.g. keylru,field,size or keyperfect,field).",
      argument: "<spec>",
    },
    {
      flags: ["--dlclumper"],
      description: "Domain language clumper specification.",
      argument: "<expression>",
    },
    {
      flags: ["--list-clumpers"],
      description: "List available clumpers and exit.",
    },
    {
      flags: ["--show-clumper"],
      description: "Show details of a specific clumper and exit.",
      argument: "<name>",
    },
  ],
  examples: [
    {
      description: "Tag lines with counts by thread",
      command: "recs multiplex -k thread -- recs eval 'r.nbr = ++nbr'",
    },
    {
      description:
        "Separate out a stream of text by PID into separate invocations of an operation",
      command:
        "recs fromre '^(.*PID=([0-9]*).*)$' -f line,pid | recs multiplex -L line -k pid -- recs frommultire ...",
    },
    {
      description: "Write each group's CSV output to separate files by department",
      command:
        "recs multiplex -k department -O 'output-{{department}}.csv' -- recs tocsv",
    },
  ],
  seeAlso: ["collate", "chain"],
};
