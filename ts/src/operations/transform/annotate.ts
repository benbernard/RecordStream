import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Executor } from "../../Executor.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey, setKey } from "../../KeySpec.ts";
import { Record } from "../../Record.ts";
import type { JsonValue, JsonObject } from "../../types/json.ts";

/**
 * Add computed fields to records, caching annotations by key grouping.
 * When a record with the same key values is seen again, the cached
 * annotation is applied instead of re-evaluating the snippet.
 *
 * Analogous to App::RecordStream::Operation::annotate in Perl.
 */
export class AnnotateOperation extends Operation {
  executor!: Executor;
  keyGroups = new KeyGroups();
  annotations = new Map<string, Map<string, JsonValue>>();

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "keys",
        short: "k",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Keys to match records by",
      },
    ];

    const remaining = this.parseOptions(args, defs);
    const expression = remaining.join(" ");

    if (!this.keyGroups.hasAnyGroup()) {
      throw new Error("Must specify at least one --key, maybe you want xform instead?");
    }

    // The expression modifies the record and returns it
    const code = `${expression}\n; return r;`;
    this.executor = new Executor(code);
  }

  acceptRecord(record: Record): boolean {
    const data = record.dataRef() as JsonObject;
    const specs = this.keyGroups.getKeyspecsForRecord(data);

    // Build synthetic key from sorted key values
    const values: string[] = [];
    for (const key of [...specs].sort()) {
      const value = findKey(data, key, true);
      values.push(String(value ?? ""));
    }
    const syntheticKey = values.join("\x1E"); // ASCII record separator

    const cached = this.annotations.get(syntheticKey);
    if (cached) {
      // Apply cached annotation
      for (const [keyspec, value] of cached) {
        setKey(data, keyspec, value);
      }
      this.pushRecord(record);
      return true;
    }

    // Take a snapshot of the data before execution
    const before = JSON.parse(JSON.stringify(data)) as JsonObject;

    // Execute the snippet
    const result = this.executor.executeCode(record);

    // Determine what changed: compare before and after
    const changes = new Map<string, JsonValue>();
    const afterData = (result instanceof Record ? result.dataRef() : data) as JsonObject;
    this.findChanges(before, afterData, "", changes);

    this.annotations.set(syntheticKey, changes);

    if (result instanceof Record) {
      this.pushRecord(result);
    } else {
      this.pushRecord(record);
    }

    return true;
  }

  findChanges(
    before: JsonObject,
    after: JsonObject,
    prefix: string,
    changes: Map<string, JsonValue>
  ): void {
    // Check for new or changed keys in after
    for (const key of Object.keys(after)) {
      const fullKey = prefix ? `${prefix}/${key}` : key;
      const beforeVal = before[key];
      const afterVal = after[key];

      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes.set(fullKey, afterVal ?? null);
      }
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "annotate",
  category: "transform",
  synopsis: "recs annotate [options] <expression> [files...]",
  description:
    "Evaluate an expression on each record and cache the resulting changes " +
    "by key grouping. When a record with the same key values is seen again, " +
    "the cached annotation is applied instead of re-evaluating the expression. " +
    "Only use this if you have --keys fields that are repeated; otherwise " +
    "recs xform will be faster.",
  options: [
    {
      flags: ["--keys", "-k"],
      description:
        "Keys to match records by. May be specified multiple times. " +
        "May be a keygroup or keyspec.",
      argument: "<keys>",
      required: true,
    },
  ],
  examples: [
    {
      description: "Annotate records with IPs with hostnames, only doing lookup once",
      command: "recs annotate --key ip 'r.hostname = lookupHost(r.ip)'",
    },
    {
      description: "Record md5sums of files",
      command: "recs annotate --key filename 'r.md5 = computeMd5(r.filename)'",
    },
  ],
  seeAlso: ["xform"],
};
