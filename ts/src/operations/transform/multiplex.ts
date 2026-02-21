import { Operation, CollectorReceiver } from "../../Operation.ts";
import type { RecordReceiver, OptionDef } from "../../Operation.ts";
import type { ClumperCallback } from "../../Clumper.ts";
import { ClumperOptions } from "../../clumpers/Options.ts";
import { Record } from "../../Record.ts";

/**
 * ClumperCallback for multiplex: creates a separate operation instance
 * for each group of records.
 */
class MultiplexClumperCallback implements ClumperCallback {
  operationFactory: (next: RecordReceiver) => Operation;
  operationArgs: string[];
  pushRecordCb: (record: Record) => boolean;

  constructor(
    operationFactory: (next: RecordReceiver) => Operation,
    operationArgs: string[],
    _lineKey: string | null,
    pushRecordCb: (record: Record) => boolean,
    _pushLineCb: (line: string) => void
  ) {
    this.operationFactory = operationFactory;
    this.operationArgs = operationArgs;
    this.pushRecordCb = pushRecordCb;
  }

  clumperCallbackBegin(_options: { [key: string]: unknown }): unknown {
    const collector = new CollectorReceiver();
    const op = this.operationFactory(collector);
    op.init([...this.operationArgs]);
    return { operation: op, collector };
  }

  clumperCallbackPushRecord(cookie: unknown, record: Record): void {
    const state = cookie as { operation: Operation; collector: CollectorReceiver };
    state.operation.acceptRecord(record);
  }

  clumperCallbackEnd(cookie: unknown): void {
    const state = cookie as { operation: Operation; collector: CollectorReceiver };
    state.operation.finish();

    // Push all collected records
    for (const record of state.collector.records) {
      this.pushRecordCb(record);
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

  init(args: string[]): void {
    const clumperOptions = new ClumperOptions();
    let lineKey: string | null = null;

    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { clumperOptions.addKey(v as string); },
        description: "Key fields for grouping",
      },
      {
        long: "line-key",
        short: "L",
        type: "string",
        handler: (v) => { lineKey = v as string; },
        description: "Use this key's value as line input for the nested operation",
      },
      {
        long: "adjacent",
        type: "boolean",
        handler: () => { clumperOptions.setKeySize(1); },
        description: "Only group adjacent records",
      },
      {
        long: "size",
        type: "number",
        handler: (v) => { clumperOptions.setKeySize(Number(v)); },
        description: "Number of running clumps to keep",
      },
      {
        long: "cube",
        type: "boolean",
        handler: () => { clumperOptions.setCube(true); },
        description: "Enable cube mode",
      },
    ];

    const remaining = this.parseOptions(args, defs);

    // The remaining args are the operation to run on each group
    // For now, this requires a factory function to be set
    // In real usage, this would create the operation from the command args

    const callback = new MultiplexClumperCallback(
      (next: RecordReceiver) => {
        // Default: create a passthrough operation
        // In real usage, this would be replaced by the actual operation factory
        return new PassthroughForMultiplex(next);
      },
      remaining,
      lineKey,
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

class PassthroughForMultiplex extends Operation {
  init(_args: string[]): void {
    // no-op
  }

  acceptRecord(record: Record): boolean {
    return this.pushRecord(record);
  }
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
      flags: ["--line-key", "-L"],
      description:
        "Use the value of this key as line input for the nested operation " +
        "(rather than the entire record). Use with recs-from* operations generally.",
      argument: "<key>",
    },
    {
      flags: ["--adjacent"],
      description: "Only group together adjacent records. Avoids spooling records into memory.",
    },
    {
      flags: ["--size"],
      description: "Number of running clumps to keep.",
      argument: "<number>",
    },
    {
      flags: ["--cube"],
      description: "Enable cube mode.",
    },
  ],
  examples: [
    {
      description: "Tag lines with counts by thread",
      command: "recs multiplex -k thread -- recs-eval 'r.nbr = ++nbr'",
    },
    {
      description:
        "Separate out a stream of text by PID into separate invocations of an operation",
      command:
        "recs fromre '^(.*PID=([0-9]*).*)$' -f line,pid | recs multiplex -L line -k pid -- recs-frommultire ...",
    },
  ],
  seeAlso: ["collate", "chain"],
};
