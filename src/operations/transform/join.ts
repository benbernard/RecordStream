import { readFileSync } from "node:fs";
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
  matchedDbKeys = new Set<string>();

  override addHelpTypes(): void {
    this.useHelpType("snippet");
    this.useHelpType("keyspecs");
    this.addCustomHelpType(
      "full",
      joinFullHelp,
      "Help on join types and accumulate-right",
    );
  }

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
    const dbFile = remaining[2]!;

    this.keepLeft = left || outer;
    this.keepRight = right || outer;

    // Suppress unused var warnings for inner
    void inner;

    // Load db records from the file
    this.loadDbFromFile(dbFile);
  }

  /**
   * Load db records from a JSONL file.
   */
  loadDbFromFile(filePath: string): void {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim() !== "");
    const records = lines.map((line) => Record.fromJSON(line));
    this.loadDbRecords(records);
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
          this.matchedDbKeys.add(value);
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
    if (this.accumulateRight) {
      // Output matched db records (they've been accumulated into)
      for (const [key, dbRecords] of this.db) {
        if (this.matchedDbKeys.has(key)) {
          for (const dbRecord of dbRecords) {
            this.pushRecord(dbRecord);
          }
        } else if (this.keepLeft) {
          // Unmatched db records only in left/outer join mode
          for (const dbRecord of dbRecords) {
            this.pushRecord(dbRecord);
          }
        }
      }
      return;
    }

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
  }
}

function joinFullHelp(): string {
  return `JOIN FULL HELP:

OVERVIEW:
  Join combines two record streams based on matching key values. One stream
  (the "db" file) is loaded entirely into memory, and then input records
  are matched against it.

  Usage: recs join [options] <inputkey> <dbkey> <dbfile> [files...]

  - inputkey: The field to match on in the input stream
  - dbkey: The field to match on in the db file
  - dbfile: Path to the file containing db records (one JSON per line)

JOIN TYPES:
  By default, join performs an INNER join: only records where both input
  and db have matching keys are output.

  --inner (default)
    Output only matched pairs. If a db record has key "foo" and an input
    record also has key "foo", they are merged and output. Unmatched
    records from either side are dropped.

  --left
    Include all db records, even if no input record matches. After
    processing all input, any db records that were never matched are
    output as-is. This ensures every db record appears in the output.

  --right
    Include all input records, even if no db record matches. Input
    records with no matching db record are passed through unchanged.

  --outer
    Include all records from both sides. Equivalent to --left --right.
    Both unmatched db records and unmatched input records appear in output.

FIELD MERGING:
  When a match is found, the two records are merged. By default, fields
  from the db record OVERWRITE fields from the input record. The merged
  record contains all fields from both records.

  Example:
    Input: {"id": 1, "name": "Alice", "score": 90}
    DB:    {"id": 1, "department": "Engineering", "name": "A. Smith"}
    Output: {"id": 1, "name": "A. Smith", "score": 90, "department": "Engineering"}

  Note: "name" from db overwrites "name" from input.

CUSTOM MERGE WITH --operation:
  Use --operation to specify a JavaScript expression that controls how
  records are merged. The variables 'd' (db record data) and 'i' (input
  record data) are available:

    recs join --operation 'd.total = (d.total || 0) + i.amount' \\
      id id db.json

  The expression modifies 'd' (the output record) in place.

ACCUMULATE-RIGHT MODE:
  With --accumulate-right, instead of outputting a merged record for each
  match, input record fields are accumulated ONTO the db records. Output
  happens only at stream end, when the accumulated db records are emitted.

  This is useful when you want to enrich db records with data from multiple
  input records. For each matching input record, new fields (fields not
  already present in the db record) are added to the db record.

  Example:
    DB file (users.json):
      {"id": 1, "name": "Alice"}
      {"id": 2, "name": "Bob"}

    Input stream:
      {"id": 1, "score": 90}
      {"id": 1, "rank": 3}
      {"id": 2, "score": 85}

    recs join --accumulate-right id id users.json

    Output:
      {"id": 1, "name": "Alice", "score": 90, "rank": 3}
      {"id": 2, "name": "Bob", "score": 85}

  Note: With accumulate-right, only the first new value for each field is
  kept (subsequent matches don't overwrite). Combined with --left, unmatched
  db records are also output.

MULTI-KEY JOINS:
  Both inputkey and dbkey can be comma-separated lists for multi-field
  matching:

    recs join host,port host,port services.json

  Records match only when ALL specified key fields agree.

COMMON PATTERNS:
  Enrich records with a lookup table:
    recs join type typeName typeMapping.json < data.json

  Left join to keep all db records:
    recs join --left userId id users.json < events.json

  Outer join for full picture:
    recs join --outer hostId hostId inventory.json < metrics.json

  Custom merge with operation:
    recs join --operation 'd.count = (d.count||0) + 1' \\
      key key db.json < input.json
`;
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
