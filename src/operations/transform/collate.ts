import { Operation, HelpExit } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import {
  aggregatorRegistry,
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
import { parseDomainLanguage, mapReduceAgg, injectIntoAgg, snippetValuation } from "../../DomainLanguage.ts";

// Ensure all aggregators are registered
import "../../aggregators/registry.ts";

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
      dirty: false,
    };
  }

  clumperCallbackPushRecord(cookie: unknown, record: Record): void {
    const state = cookie as CollateCookie;
    if (!this.bucket && state.records) {
      state.records.push(record);
    }
    state.cookies = mapCombine(this.aggregators, state.cookies, record);
    state.dirty = true;

    if (this.incremental) {
      this.clumperCallbackEnd(cookie);
    }
  }

  clumperCallbackEnd(cookie: unknown): void {
    const state = cookie as CollateCookie;

    // In incremental mode, skip if nothing new was pushed since last emission
    if (this.incremental && !state.dirty) {
      return;
    }
    state.dirty = false;

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
  dirty: boolean;
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
  extraArgs: string[] = [];
  clumperOptions!: ClumperOptions;
  incremental = false;

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
    this.useHelpType("keygroups");
    this.useHelpType("keys");
    this.useHelpType("domainlanguage");
    this.useHelpType("clumping");
    this.addCustomHelpType(
      "aggregators",
      () => aggregatorRegistry.listImplementations(),
      "List the aggregators",
    );
    this.addCustomHelpType(
      "more",
      collateMoreHelp,
      "Larger help documentation for collate",
    );
  }

  init(args: string[]): void {
    const clumperOptions = new ClumperOptions();
    const aggregatorSpecs: string[] = [];
    const dlAggregators = new Map<string, AnyAggregator>();
    const mrAggParts: string[] = [];
    const iiAggParts: string[] = [];
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
        long: "dlaggregator",
        short: "A",
        type: "string",
        handler: (v) => {
          const str = v as string;
          const eqIdx = str.indexOf("=");
          if (eqIdx < 0) {
            throw new Error(`Bad domain language aggregator option (missing '=' to separate name and code): ${str}`);
          }
          const name = str.slice(0, eqIdx);
          const code = str.slice(eqIdx + 1);
          dlAggregators.set(name, parseDomainLanguage(code));
        },
        description: "Domain language aggregator (name=expression)",
      },
      {
        long: "mr-agg",
        type: "string",
        nargs: 4,
        handler: (v) => { mrAggParts.push(v as string); },
        description: "MapReduce aggregator: --mr-agg name map_snippet reduce_snippet squish_snippet",
      },
      {
        long: "ii-agg",
        type: "string",
        nargs: 4,
        handler: (v) => { iiAggParts.push(v as string); },
        description: "InjectInto aggregator: --ii-agg name initial_snippet combine_snippet squish_snippet",
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
          // DL key: the code evaluates as a valuation, which is used as a synthetic key
          const name = str.slice(0, eqIdx);
          const code = str.slice(eqIdx + 1);
          // Create a valuation from the DL code and use as a key
          void snippetValuation(code);
          clumperOptions.addKey(name);
        },
        description: "Domain language key (name=expression evaluating to a valuation)",
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
        handler: (v) => { bucket = v as boolean; },
        description: "Output one record per clump (default)",
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
        description: "Enable cube mode (all key combinations with ALL)",
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
        short: "C",
        type: "string",
        handler: (v) => { clumperOptions.addClumper(v as string); },
        description: "Domain language clumper specification",
      },
      {
        long: "perfect",
        type: "boolean",
        handler: () => { clumperOptions.setPerfect(true); },
        description: "Group records regardless of order (perfect hashing)",
      },
      {
        long: "list-aggregators",
        type: "boolean",
        handler: () => {
          throw new HelpExit(aggregatorRegistry.listImplementations());
        },
        description: "List available aggregators and exit",
      },
      {
        long: "list",
        type: "boolean",
        handler: () => {
          throw new HelpExit(aggregatorRegistry.listImplementations());
        },
        description: "Alias for --list-aggregators",
      },
      {
        long: "show-aggregator",
        type: "string",
        handler: (v) => {
          throw new HelpExit(aggregatorRegistry.showImplementation(v as string));
        },
        description: "Show details of a specific aggregator and exit",
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

    this.extraArgs = this.parseOptions(args, defs);

    // Build the aggregators map: start with -a specs, then merge DL aggregators
    const aggregators = makeAggregators(...aggregatorSpecs);

    // Merge domain language aggregators
    for (const [name, agg] of dlAggregators) {
      aggregators.set(name, agg);
    }

    // Process --mr-agg (groups of 4: name, map, reduce, squish)
    if (mrAggParts.length % 4 !== 0) {
      throw new Error(`--mr-agg requires groups of 4 arguments (name, map, reduce, squish), got ${mrAggParts.length}`);
    }
    for (let j = 0; j < mrAggParts.length; j += 4) {
      const name = mrAggParts[j]!;
      const mapExpr = mrAggParts[j + 1]!;
      const reduceExpr = mrAggParts[j + 2]!;
      const squishExpr = mrAggParts[j + 3]!;
      aggregators.set(name, mapReduceAgg(mapExpr, reduceExpr, squishExpr));
    }

    // Process --ii-agg (groups of 4: name, initial, combine, squish)
    if (iiAggParts.length % 4 !== 0) {
      throw new Error(`--ii-agg requires groups of 4 arguments (name, initial, combine, squish), got ${iiAggParts.length}`);
    }
    for (let j = 0; j < iiAggParts.length; j += 4) {
      const name = iiAggParts[j]!;
      const initialExpr = iiAggParts[j + 1]!;
      const combineExpr = iiAggParts[j + 2]!;
      const squishExpr = iiAggParts[j + 3]!;
      aggregators.set(name, injectIntoAgg(initialExpr, combineExpr, squishExpr));
    }

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
    // Always flush remaining clumps. In incremental mode, the dirty flag
    // in the callback prevents duplicate emissions for already-flushed state.
    this.clumperOptions.streamDone();
  }
}

function collateMoreHelp(): string {
  return `COLLATE EXTENDED HELP:

Collate is the primary aggregation operation in RecordStream. It groups
records together by key fields and computes aggregate statistics within
those groups.

GROUPING (CLUMPING):
  By default, collate groups records using "perfect" clumping: all records
  with the same key values end up in the same group, regardless of order.
  This requires holding all groups in memory.

  For large or streaming data, use --adjacent (-1) to only group consecutive
  records with the same key. This uses O(1) memory but requires the input
  to be sorted by the grouping key.

  The --size (-n) flag limits the number of active groups (LRU eviction).
  --adjacent is equivalent to --size 1.

  The --cube flag generates all 2^N key combinations, replacing each subset
  of keys with "ALL". This is useful for generating rollup summaries.

AGGREGATORS:
  Specify aggregators with -a in the form: [name=]aggregator[,args...]
  Multiple -a flags or colon-separated specs are supported.

  If no name is given, one is auto-generated from the aggregator and field
  names (e.g. "count" becomes "count", "sum,price" becomes "sum_price").

  Examples:
    -a count                    Count records in each group
    -a total=sum,price          Sum of "price", stored as "total"
    -a avg,latency              Average of "latency"
    -a worst=max,latency        Maximum latency
    -a perc,95,response_time    95th percentile of response_time

DOMAIN LANGUAGE AGGREGATORS:
  Use -A (--dlaggregator) for inline JavaScript aggregator expressions:
    -A 'weighted_avg=xform(recs(), "{{total}} / {{count}}")'

  Use --ii-agg for inject-into aggregators (4 args: name, initial, combine, squish):
    --ii-agg running_avg "[0,0]" "[$a[0]+{{val}},$a[1]+1]" "$a[0]/$a[1]"

  Use --mr-agg for map-reduce aggregators (4 args: name, map, reduce, squish):
    --mr-agg total_and_count "[{{val}},1]" "[$a[0]+$b[0],$a[1]+$b[1]]" "$a[0]/$a[1]"

  See --help-domainlanguage for the full domain language reference.

BUCKET VS NON-BUCKET MODE:
  By default (--bucket), collate outputs one record per group containing
  only the key fields and aggregated values.

  With --no-bucket, collate outputs one record per INPUT record, with each
  record augmented by the aggregated values from its group. This is useful
  for annotating records with group-level statistics.

INCREMENTAL MODE:
  With --incremental (-i), collate outputs a record every time a new input
  record is added to a group (rather than waiting until the group is flushed).
  The aggregated values reflect the running totals up to that point. This is
  useful for computing running aggregates.

COMMON PATTERNS:
  Count by group:
    recs collate -k host -a count

  Multiple aggregations:
    recs collate -k date -a count -a total=sum,revenue -a avg,latency

  Running sum (cumulative):
    recs collate -k date --adjacent --incremental -a running=sum,value

  Cube rollup:
    recs collate -k region,product --cube -a sum,sales

  Adjacent grouping (streaming):
    sort -k1 data.json | recs collate -k category --adjacent -a count
`;
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
      flags: ["--dlaggregator", "-A"],
      description:
        "Domain language aggregator in the form name=expression. " +
        "The expression is evaluated as JavaScript to produce an aggregator.",
      argument: "<name>=<expression>",
    },
    {
      flags: ["--mr-agg"],
      description:
        "MapReduce aggregator: takes 4 arguments: name, map snippet, reduce snippet, squish snippet.",
      argument: "<name> <map> <reduce> <squish>",
    },
    {
      flags: ["--ii-agg"],
      description:
        "InjectInto aggregator: takes 4 arguments: name, initial snippet, combine snippet, squish snippet.",
      argument: "<name> <initial> <combine> <squish>",
    },
    {
      flags: ["--dlkey", "-K"],
      description:
        "Domain language key: name=expression where the expression evaluates as a valuation.",
      argument: "<name>=<expression>",
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
      description:
        "Enable cube mode: output all key combinations with ALL placeholders.",
    },
    {
      flags: ["--clumper", "-c"],
      description:
        "Clumper specification (e.g. keylru,field,size or keyperfect,field or window,size).",
      argument: "<spec>",
    },
    {
      flags: ["--dlclumper", "-C"],
      description: "Domain language clumper specification.",
      argument: "<expression>",
    },
    {
      flags: ["--perfect"],
      description: "Group records regardless of order (perfect hashing).",
    },
    {
      flags: ["--list-aggregators"],
      description: "List available aggregators and exit.",
    },
    {
      flags: ["--show-aggregator"],
      description: "Show details of a specific aggregator and exit.",
      argument: "<name>",
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
