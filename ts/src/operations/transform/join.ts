import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { findKey } from "../../KeySpec.ts";
import { Record } from "../../Record.ts";
import type { JsonObject, JsonValue } from "../../types/json.ts";

/**
 * Join two record streams on a key. The "db" stream is loaded into memory,
 * then the input stream is matched against it.
 *
 * Analogous to App::RecordStream::Operation::join in Perl.
 */
export class JoinOperation extends Operation {
  inputKey = "";
  dbKey = "";
  keepLeft = false;
  keepRight = false;
  accumulateRight = false;
  operationExpr: string | null = null;
  db = new Map<string, Record[]>();
  keysPrinted = new Set<string>();

  init(args: string[]): void {
    let left = false;
    let right = false;
    let inner = false;
    let outer = false;

    const defs: OptionDef[] = [
      {
        long: "left",
        type: "boolean",
        handler: () => { left = true; },
        description: "Do a left join",
      },
      {
        long: "right",
        type: "boolean",
        handler: () => { right = true; },
        description: "Do a right join",
      },
      {
        long: "inner",
        type: "boolean",
        handler: () => { inner = true; },
        description: "Do an inner join (default)",
      },
      {
        long: "outer",
        type: "boolean",
        handler: () => { outer = true; },
        description: "Do an outer join",
      },
      {
        long: "operation",
        type: "string",
        handler: (v) => { this.operationExpr = v as string; },
        description: "JS expression for merging two records",
      },
      {
        long: "accumulate-right",
        type: "boolean",
        handler: () => { this.accumulateRight = true; },
        description: "Accumulate input records onto db records",
      },
    ];

    const remaining = this.parseOptions(args, defs);

    if (remaining.length < 3) {
      throw new Error("Usage: join <inputkey> <dbkey> <dbfile>");
    }

    this.inputKey = remaining[0]!;
    this.dbKey = remaining[1]!;

    // remaining[2] is dbfile - we'll load records from it
    // In TS version, the db is loaded via loadDbRecords() method

    this.keepLeft = left || outer;
    this.keepRight = right || outer;

    // Suppress unused var warnings for inner
    void inner;
  }

  /**
   * Load the "db" records from an array. In the Perl version this reads
   * from a file. In the TS port, the caller passes records directly.
   */
  loadDbRecords(records: Record[]): void {
    for (const record of records) {
      const value = this.valueForKey(record, this.dbKey);
      const existing = this.db.get(value);
      if (existing) {
        existing.push(record);
      } else {
        this.db.set(value, [record]);
      }
    }
  }

  valueForKey(record: Record, key: string): string {
    const keys = key.split(",");
    return keys
      .map((k) => {
        const data = record.dataRef() as JsonObject;
        return String(findKey(data, k, true) ?? "");
      })
      .join("\x1E"); // ASCII record separator
  }

  acceptRecord(record: Record): boolean {
    const value = this.valueForKey(record, this.inputKey);
    const dbRecords = this.db.get(value);

    if (dbRecords) {
      for (const dbRecord of dbRecords) {
        if (this.accumulateRight) {
          if (this.operationExpr) {
            this.runExpression(dbRecord, record);
          } else {
            // Merge input fields into db record (only new fields)
            const inputData = record.dataRef() as JsonObject;
            const dbData = dbRecord.dataRef() as JsonObject;
            for (const key of Object.keys(inputData)) {
              if (!(key in dbData)) {
                dbData[key] = inputData[key] as JsonValue;
              }
            }
          }
        } else {
          if (this.operationExpr) {
            const outputRecord = dbRecord.clone();
            this.runExpression(outputRecord, record);
            this.pushRecord(outputRecord);
          } else {
            // Merge: input fields overlaid with db fields
            const merged = new Record({
              ...record.toJSON(),
              ...dbRecord.toJSON(),
            });
            this.pushRecord(merged);
          }

          if (this.keepLeft) {
            this.keysPrinted.add(value);
          }
        }
      }
    } else if (this.keepRight) {
      this.pushRecord(record);
    }

    return true;
  }

  runExpression(d: Record, i: Record): void {
    if (!this.operationExpr) return;

    // Create a simple execution context for the merge operation
    const fn = new Function("d", "i", this.operationExpr);
    try {
      fn(d.dataRef(), i.dataRef());
    } catch (e) {
      console.warn(`Operation expression failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  override streamDone(): void {
    if (this.keepLeft) {
      for (const [, dbRecords] of this.db) {
        for (const dbRecord of dbRecords) {
          const value = this.valueForKey(dbRecord, this.dbKey);
          if (!this.keysPrinted.has(value)) {
            this.pushRecord(dbRecord);
          }
        }
      }
    }

    // If accumulate-right, output the db records at the end
    if (this.accumulateRight) {
      for (const [, dbRecords] of this.db) {
        for (const dbRecord of dbRecords) {
          this.pushRecord(dbRecord);
        }
      }
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "join",
  category: "transform",
  synopsis: "recs join [options] <inputkey> <dbkey> <dbfile> [files...]",
  description:
    "Join two record streams on a key. Records of input are joined against " +
    "records in dbfile, using field inputkey from input and field dbkey from " +
    "dbfile. Each pair of matches will be combined to form a larger record, " +
    "with fields from the dbfile overwriting fields from the input stream.",
  options: [
    {
      flags: ["--left"],
      description: "Do a left join (include unmatched db records).",
    },
    {
      flags: ["--right"],
      description: "Do a right join (include unmatched input records).",
    },
    {
      flags: ["--inner"],
      description: "Do an inner join (default). Only matched pairs are output.",
    },
    {
      flags: ["--outer"],
      description: "Do an outer join (include all unmatched records from both sides).",
    },
    {
      flags: ["--operation"],
      description:
        "A JS expression for merging two records together, in place of the " +
        "default behavior of db fields overwriting input fields. Variables d " +
        "and i are the db record and input record respectively.",
      argument: "<expression>",
    },
    {
      flags: ["--accumulate-right"],
      description:
        "Accumulate all input records with the same key onto each db record " +
        "matching that key.",
    },
  ],
  examples: [
    {
      description: "Join type from input and typeName from dbfile",
      command: "cat recs | recs join type typeName dbfile",
    },
    {
      description: "Join host name from a mapping file to machines",
      command: "recs join host host hostIpMapping machines",
    },
  ],
  seeAlso: ["collate", "xform"],
};
