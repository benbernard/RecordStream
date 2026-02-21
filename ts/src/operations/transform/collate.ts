import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import {
  makeAggregators,
  mapInitial,
  mapCombine,
  mapSquish,
} from "../../Aggregator.ts";
import type { AnyAggregator } from "../../Aggregator.ts";
import type { ClumperCallback } from "../../Clumper.ts";
import { ClumperOptions } from "../../clumpers/Options.ts";
import { Record } from "../../Record.ts";
import { setKey } from "../../KeySpec.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * ClumperCallback for collate: receives groups of records,
 * aggregates them, and emits output records.
 */
class CollateClumperCallback implements ClumperCallback {
  aggregators: Map<string, AnyAggregator>;
  incremental: boolean;
  bucket: boolean;
  recordCb: (record: Record) => void;

  constructor(
    aggregators: Map<string, AnyAggregator>,
    incremental: boolean,
    bucket: boolean,
    recordCb: (record: Record) => void
  ) {
    this.aggregators = aggregators;
    this.incremental = incremental;
    this.bucket = bucket;
    this.recordCb = recordCb;
  }

  clumperCallbackBegin(options: { [key: string]: unknown }): unknown {
    return {
      bucket: options as unknown,
      records: this.bucket ? null : ([] as Record[]),
      cookies: mapInitial(this.aggregators),
    };
  }

  clumperCallbackPushRecord(cookie: unknown, record: Record): void {
    const state = cookie as CollateCookie;
    if (!this.bucket && state.records) {
      state.records.push(record);
    }
    state.cookies = mapCombine(this.aggregators, state.cookies, record);

    if (this.incremental) {
      this.clumperCallbackEnd(cookie);
    }
  }

  clumperCallbackEnd(cookie: unknown): void {
    const state = cookie as CollateCookie;
    const squished = mapSquish(this.aggregators, state.cookies);

    const protos = this.bucket
      ? [state.bucket as JsonObject]
      : (state.records ?? []).map((r: Record) => r.toJSON());

    for (const proto of protos) {
      const outputRecord = new Record();

      // First, apply the bucket/original record fields
      if (proto && typeof proto === "object") {
        for (const [key, value] of Object.entries(proto as JsonObject)) {
          setKey(outputRecord.dataRef() as JsonObject, key, value);
        }
      }

      // Then, apply the aggregated values
      for (const [key, value] of squished) {
        setKey(outputRecord.dataRef() as JsonObject, key, value);
      }

      this.recordCb(outputRecord);
    }
  }
}

interface CollateCookie {
  bucket: unknown;
  records: Record[] | null;
  cookies: Map<string, unknown>;
}

/**
 * Group and aggregate records. The most complex operation in RecordStream.
 *
 * Supports:
 * - -k key for grouping keys
 * - -a aggregator,field,name for named aggregators
 * - Clumper options (--adjacent, --cube, --size, etc.)
 * - Incremental mode, bucket mode
 *
 * Analogous to App::RecordStream::Operation::collate in Perl.
 */
export class CollateOperation extends Operation {
  clumperOptions!: ClumperOptions;
  incremental = false;

  init(args: string[]): void {
    const clumperOptions = new ClumperOptions();
    const aggregatorSpecs: string[] = [];
    let incremental = false;
    let bucket = true;

    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { clumperOptions.addKey(v as string); },
        description: "Grouping key fields",
      },
      {
        long: "aggregator",
        short: "a",
        type: "string",
        handler: (v) => { aggregatorSpecs.push(v as string); },
        description: "Aggregator specification",
      },
      {
        long: "incremental",
        short: "i",
        type: "boolean",
        handler: () => { incremental = true; this.incremental = true; },
        description: "Output a record every time an input record is added to a clump",
      },
      {
        long: "bucket",
        type: "boolean",
        handler: () => { bucket = true; },
        description: "Output one record per clump (default)",
      },
      {
        long: "no-bucket",
        type: "boolean",
        handler: () => { bucket = false; },
        description: "Output one record for each record in the clump",
      },
      {
        long: "adjacent",
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
        long: "cube",
        type: "boolean",
        handler: () => { clumperOptions.setCube(true); },
        description: "Enable cube mode (all key combinations with ALL)",
      },
      {
        long: "list-aggregators",
        type: "boolean",
        handler: () => {
          // Would print aggregator list
        },
        description: "List available aggregators",
      },
    ];

    this.parseOptions(args, defs);

    const aggregators = makeAggregators(...aggregatorSpecs);

    const callback = new CollateClumperCallback(
      aggregators,
      incremental,
      bucket,
      (record: Record) => { this.pushRecord(record); }
    );

    clumperOptions.checkOptions(callback);
    this.clumperOptions = clumperOptions;
  }

  acceptRecord(record: Record): boolean {
    this.clumperOptions.acceptRecord(record);
    return true;
  }

  override streamDone(): void {
    // In incremental mode, each push already emitted output;
    // the final end would duplicate the last record
    if (!this.incremental) {
      this.clumperOptions.streamDone();
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "collate",
  category: "transform",
  synopsis: "recs collate [options] [files...]",
  description:
    "Take records, grouped together by --keys, and compute statistics " +
    "(like average, count, sum, concat, etc.) within those groups.",
  options: [
    {
      flags: ["--key", "-k"],
      description:
        "Comma-separated list of key fields for grouping. May be a key spec or key group.",
      argument: "<keys>",
    },
    {
      flags: ["--aggregator", "-a"],
      description:
        "Colon-separated aggregator specification in the form [<fieldname>=]<aggregator>[,<arguments>].",
      argument: "<aggregators>",
    },
    {
      flags: ["--incremental", "-i"],
      description:
        "Output a record every time an input record is added to a clump " +
        "(instead of every time a clump is flushed).",
    },
    {
      flags: ["--bucket"],
      description: "Output one record per clump (default).",
    },
    {
      flags: ["--no-bucket"],
      description: "Output one record for each record that went into the clump.",
    },
    {
      flags: ["--adjacent"],
      description: "Only group together adjacent records. Avoids spooling records into memory.",
    },
    {
      flags: ["--size", "-n"],
      description: "Number of running clumps to keep.",
      argument: "<number>",
    },
    {
      flags: ["--cube"],
      description:
        "Enable cube mode: output all key combinations with ALL placeholders.",
    },
    {
      flags: ["--list-aggregators"],
      description: "List available aggregators and exit.",
    },
  ],
  examples: [
    {
      description: "Count number of each x field value in the entire file",
      command: "recs collate --key x --aggregator count",
    },
    {
      description: "Find the maximum latency for each date, hour pair",
      command: "recs collate --key date,hour --aggregator worst_latency=max,latency",
    },
    {
      description: "Produce a cumulative sum of profit up to each date",
      command: "recs collate --key date --adjacent --incremental --aggregator profit_to_date=sum,profit",
    },
    {
      description: "Count clumps of adjacent lines with matching x fields",
      command: "recs collate --adjacent --key x --aggregator count",
    },
  ],
  seeAlso: ["decollate", "sort", "multiplex"],
};
