import stringWidth from "string-width";
import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { Accumulator } from "../../Accumulator.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { KeySpec } from "../../KeySpec.ts";
import type { JsonObject } from "../../types/json.ts";

function displayWidth(str: string): number {
  return stringWidth(str);
}

/**
 * A node in the values tree used to track unique value tuples.
 * [0] = children map, [1] = insertion-order keys, [2] = assigned index (-1 if unset)
 */
type ValuesNode = [Map<string, ValuesNode>, string[], number];

function newNode(): ValuesNode {
  return [new Map(), [], -1];
}

function touchNodeRecurse(node: ValuesNode, keys: string[]): void {
  if (keys.length === 0) return;

  const [hash, array] = node;
  const key = keys[0]!;
  let nextNode = hash.get(key);
  if (!nextNode) {
    nextNode = newNode();
    hash.set(key, nextNode);
    array.push(key);
  }

  touchNodeRecurse(nextNode, keys.slice(1));
}

function findIndexRecursive(node: ValuesNode, path: string[]): number {
  if (path.length === 0) return node[2];

  const hash = node[0];
  const key = path[0]!;
  const nextNode = hash.get(key);
  if (!nextNode) {
    throw new Error("Missing key " + key + " followed by " + path.slice(1).join(", "));
  }

  return findIndexRecursive(nextNode, path.slice(1));
}

/**
 * Resolve a field spec list that may contain KeyGroup syntax.
 * Returns plain field specs (preserving FIELD as a literal).
 */
function resolveFieldSpecs(specs: string[], records: Record[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const spec of specs) {
    if (spec === "FIELD") {
      if (!seen.has("FIELD")) {
        seen.add("FIELD");
        result.push("FIELD");
      }
      continue;
    }

    // Check if it's a KeyGroup pattern
    if (spec.startsWith("!")) {
      const kg = new KeyGroups(spec);
      for (const record of records) {
        const data = record.dataRef();
        for (const resolved of kg.getKeyspecsForRecord(data)) {
          if (!seen.has(resolved)) {
            seen.add(resolved);
            result.push(resolved);
          }
        }
      }
    } else {
      // Plain key spec
      if (!seen.has(spec)) {
        seen.add(spec);
        result.push(spec);
      }
    }
  }

  return result;
}

/**
 * Creates a multi-dimensional pivot table with any number of x and y axes.
 *
 * Analogous to App::RecordStream::Operation::toptable in Perl.
 */
export class ToPtable extends Operation {
  accumulator = new Accumulator();
  rawXSpecs: string[] = [];
  rawYSpecs: string[] = [];
  rawVSpecs: string[] = [];
  pins: Map<string, string> = new Map();
  sorts: Map<string, (a: Record, b: Record) => number> = new Map();
  sortAllToEnd = false;
  showHeaders = true;
  doVfields = true;
  outputRecords = false;

  constructor(next?: RecordReceiver) {
    super(next);
  }

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
    this.useHelpType("keygroups");
    this.useHelpType("keys");
    this.addCustomHelpType(
      "full",
      toptableFullHelp,
      "Tutorial on toptable with many examples",
    );
  }

  init(args: string[]): void {
    const addXSpecs = (v: string) => {
      this.rawXSpecs.push(...v.split(","));
    };
    const addYSpecs = (v: string) => {
      this.rawYSpecs.push(...v.split(","));
    };
    const addVSpecs = (v: string) => {
      this.rawVSpecs.push(...v.split(","));
    };

    const defs: OptionDef[] = [
      {
        long: "x-field",
        short: "x",
        type: "string",
        handler: (v) => { addXSpecs(v as string); },
        description: "Add an x field (column axis)",
      },
      {
        long: "x",
        type: "string",
        handler: (v) => { addXSpecs(v as string); },
        description: "Add an x field (column axis)",
      },
      {
        long: "y-field",
        short: "y",
        type: "string",
        handler: (v) => { addYSpecs(v as string); },
        description: "Add a y field (row axis)",
      },
      {
        long: "y",
        type: "string",
        handler: (v) => { addYSpecs(v as string); },
        description: "Add a y field (row axis)",
      },
      {
        long: "v-field",
        short: "v",
        type: "string",
        handler: (v) => { addVSpecs(v as string); },
        description: "Specify the value field to display",
      },
      {
        long: "v",
        type: "string",
        handler: (v) => { addVSpecs(v as string); },
        description: "Specify the value field to display",
      },
      {
        long: "pin",
        short: "p",
        type: "string",
        handler: (v) => {
          for (const pair of (v as string).split(",")) {
            const eqIdx = pair.indexOf("=");
            if (eqIdx >= 0) {
              this.pins.set(pair.slice(0, eqIdx), pair.slice(eqIdx + 1));
            }
          }
        },
        description: "Pin a field to a certain value",
      },
      {
        long: "sort",
        type: "string",
        handler: (v) => {
          for (const sortSpec of (v as string).split(",")) {
            const { comparator, field } = Record.getComparatorAndField(sortSpec);
            this.sorts.set(field, comparator);
          }
        },
        description: "Sort specifications for x/y values",
      },
      {
        long: "noheaders",
        type: "boolean",
        handler: () => { this.showHeaders = false; },
        description: "Do not print row and column headers",
      },
      {
        long: "records",
        type: "boolean",
        handler: () => { this.outputRecords = true; },
        description: "Output records instead of table",
      },
      {
        long: "recs",
        type: "boolean",
        handler: () => { this.outputRecords = true; },
        description: "Output records instead of table",
      },
      {
        long: "sort-all-to-end",
        type: "boolean",
        handler: () => { this.sortAllToEnd = true; },
        description: "Sort ALL fields to the end",
      },
      {
        long: "sa",
        type: "boolean",
        handler: () => { this.sortAllToEnd = true; },
        description: "Sort ALL fields to the end",
      },
    ];

    this.parseOptions(args, defs);

    if (this.sorts.size > 0 && this.sortAllToEnd) {
      throw new Error("Cannot specify both --sort and --sort-all-to-end");
    }

    this.doVfields = this.rawVSpecs.length === 0;
  }

  acceptRecord(record: Record): boolean {
    this.accumulator.acceptRecord(record);
    return true;
  }

  override streamDone(): void {
    const records = this.accumulator.getRecords();
    if (records.length === 0) return;

    // Resolve x, y fields (FIELD is kept literal)
    const xfields = resolveFieldSpecs(this.rawXSpecs, records);
    const yfields = resolveFieldSpecs(this.rawYSpecs, records);

    // If sort-all-to-end, create comparators for all fields with "*" option
    if (this.sortAllToEnd) {
      for (const field of [...xfields, ...yfields]) {
        if (field === "FIELD") continue;
        const { comparator } = Record.getComparatorAndField(field + "=*");
        this.sorts.set(field, comparator);
      }
    }

    // Determine value fields
    let vfields: string[];
    if (this.doVfields) {
      // Auto-detect: value fields are fields not used as x, y, or pin
      const usedFirstLevelKeys = new Set<string>();
      for (const record of records) {
        const data = record.dataRef();
        for (const spec of [...xfields, ...yfields, ...this.pins.keys()]) {
          if (spec === "FIELD") continue;
          const ks = new KeySpec(spec);
          const keyList = ks.getKeyListForSpec(data);
          if (keyList.length > 0) {
            usedFirstLevelKeys.add(keyList[0]!);
          }
        }
      }

      const vfieldsSet = new Set<string>();
      vfields = [];
      for (const record of records) {
        const data = record.dataRef();
        for (const field of Object.keys(data)) {
          if (!usedFirstLevelKeys.has(field) && !vfieldsSet.has(field)) {
            vfields.push(field);
            vfieldsSet.add(field);
          }
        }
      }
      vfields.sort();
    } else {
      vfields = resolveFieldSpecs(this.rawVSpecs, records);
    }

    // Build the data tuples
    const xValuesTree = newNode();
    const yValuesTree = newNode();
    const r2: [string[], string[], string][] = [];

    for (const record of records) {
      const data = record.dataRef();

      // Check pins
      let kickout = false;
      for (const [pfield, pvalue] of this.pins) {
        if (pfield === "FIELD") continue;

        const ks = new KeySpec(pfield);
        let v = "";
        if (ks.hasKeySpec(data)) {
          const result = ks.resolve(data, true);
          v = result.value !== undefined && result.value !== null ? String(result.value) : "";
        }

        if (pvalue !== v) {
          kickout = true;
          break;
        }
      }
      if (kickout) continue;

      for (const vfield of vfields) {
        const vks = new KeySpec(vfield);
        if (!vks.hasKeySpec(data)) continue;

        // Check FIELD pin
        if (this.pins.has("FIELD") && this.pins.get("FIELD") !== vfield) continue;

        const xv: string[] = [];
        for (const xfield of xfields) {
          let v = "";
          if (xfield === "FIELD") {
            v = vfield;
          } else {
            const xks = new KeySpec(xfield);
            if (xks.hasKeySpec(data)) {
              const result = xks.resolve(data, true);
              v = result.value !== undefined && result.value !== null ? String(result.value) : "";
            }
          }
          xv.push(v);
        }

        const yv: string[] = [];
        for (const yfield of yfields) {
          let v = "";
          if (yfield === "FIELD") {
            v = vfield;
          } else {
            const yks = new KeySpec(yfield);
            if (yks.hasKeySpec(data)) {
              const result = yks.resolve(data, true);
              v = result.value !== undefined && result.value !== null ? String(result.value) : "";
            }
          }
          yv.push(v);
        }

        let v = "";
        const vResult = vks.resolve(data, true);
        if (vResult.value !== undefined && vResult.value !== null) {
          v = String(vResult.value);
        }

        touchNodeRecurse(xValuesTree, xv);
        touchNodeRecurse(yValuesTree, yv);
        r2.push([xv, yv, v]);
      }
    }

    // Dump nodes into ordered value lists
    const xValuesList: string[][] = [];
    this.dumpNodeRecurse(xValuesTree, xValuesList, [...xfields], []);

    const yValuesList: string[][] = [];
    this.dumpNodeRecurse(yValuesTree, yValuesList, [...yfields], []);

    // If outputting records instead of table
    if (this.outputRecords) {
      this.emitRecords(xfields, yfields, r2, xValuesList, yValuesList);
      return;
    }

    // Build the table grid
    const widthOffset = this.showHeaders ? yfields.length + 1 : yfields.length;
    const heightOffset = this.showHeaders ? xfields.length + 1 : xfields.length;

    const w = widthOffset + xValuesList.length;
    const h = heightOffset + yValuesList.length;

    const table: string[][] = [];
    for (let i = 0; i < h; i++) {
      const row: string[] = [];
      for (let j = 0; j < w; j++) {
        row.push("");
      }
      table.push(row);
    }

    // Fill in headers
    if (this.showHeaders) {
      for (let i = 0; i < xfields.length; i++) {
        table[i]![yfields.length] = xfields[i]!;
      }
      for (let i = 0; i < yfields.length; i++) {
        table[xfields.length]![i] = yfields[i]!;
      }
    }

    // Fill in x value headers (with deduplication)
    const lastXv = xfields.map(() => "");
    for (let i = 0; i < xValuesList.length; i++) {
      const xv = xValuesList[i]!;
      for (let j = 0; j < xfields.length; j++) {
        if (lastXv[j] !== xv[j]) {
          lastXv[j] = xv[j]!;
          table[j]![widthOffset + i] = xv[j]!;
          for (let k = j + 1; k < xfields.length; k++) {
            lastXv[k] = "";
          }
        }
      }
    }

    // Fill in y value headers (with deduplication)
    const lastYv = yfields.map(() => "");
    for (let i = 0; i < yValuesList.length; i++) {
      const yv = yValuesList[i]!;
      for (let j = 0; j < yfields.length; j++) {
        if (lastYv[j] !== yv[j]) {
          lastYv[j] = yv[j]!;
          table[heightOffset + i]![j] = yv[j]!;
          for (let k = j + 1; k < yfields.length; k++) {
            lastYv[k] = "";
          }
        }
      }
    }

    // Fill in data cells
    for (const [xv, yv, v] of r2) {
      const i = findIndexRecursive(xValuesTree, xv);
      if (i === -1) throw new Error("No index set for " + xv.join(", "));

      const j = findIndexRecursive(yValuesTree, yv);
      if (j === -1) throw new Error("No index set for " + yv.join(", "));

      table[heightOffset + j]![widthOffset + i] = v;
    }

    // Calculate column widths using visual display width
    const colWidths: number[] = [];
    for (const row of table) {
      while (colWidths.length < row.length) {
        colWidths.push(0);
      }
      for (let i = 0; i < row.length; i++) {
        const l = displayWidth(row[i]!);
        if (l > colWidths[i]!) {
          colWidths[i] = l;
        }
      }
    }

    // Output table
    for (const row of table) {
      this.pushLine(formatTableRow(colWidths, (_i, w2) => "-".repeat(w2), "+"));
      this.pushLine(formatTableRow(colWidths, (i, _w2) => (i < row.length ? row[i]! : ""), "|"));
    }
    this.pushLine(formatTableRow(colWidths, (_i, w2) => "-".repeat(w2), "+"));
  }

  getSort(field: string): ((values: string[]) => string[]) | null {
    if (field === "FIELD") return null;
    const comparator = this.sorts.get(field);
    if (!comparator) return null;

    return (values: string[]) => {
      const fakeRecords = values.map((v) => new Record({ [field]: v }));
      fakeRecords.sort(comparator);
      return fakeRecords.map((r) => {
        const val = r.get(field);
        return val !== undefined && val !== null ? String(val) : "";
      });
    };
  }

  dumpNodeRecurse(
    node: ValuesNode,
    acc: string[][],
    fieldsLeft: string[],
    valuesSoFar: string[]
  ): void {
    const [hash, array] = node;

    if (fieldsLeft.length === 0) {
      node[2] = acc.length;
      acc.push([...valuesSoFar]);
      return;
    }

    const field = fieldsLeft.shift()!;

    let fieldValues = [...array];
    const sort = this.getSort(field);
    if (sort) {
      fieldValues = sort(fieldValues);
    }

    for (const key of fieldValues) {
      valuesSoFar.push(key);
      this.dumpNodeRecurse(hash.get(key)!, acc, fieldsLeft, valuesSoFar);
      valuesSoFar.pop();
    }

    fieldsLeft.unshift(field);
  }

  emitRecords(
    xfields: string[],
    yfields: string[],
    values: [string[], string[], string][],
    orderedXValues: string[][],
    orderedYValues: string[][]
  ): void {
    const recordsMap: Map<string, JsonObject> = new Map();

    // Initialize records with empty values
    for (const yv of orderedYValues) {
      const key = yv.join("-");
      if (!recordsMap.has(key)) {
        recordsMap.set(key, {});
      }
      const rec = recordsMap.get(key)!;

      for (const xv of orderedXValues) {
        let data: JsonObject = rec;
        let lastHash: JsonObject = data;
        let lastXValue = "";

        for (let idx = 0; idx < xv.length; idx++) {
          const xName = xfields[idx]!;
          const xValue = xv[idx]!;

          if (!data[xName]) data[xName] = {};
          const xNameObj = data[xName] as JsonObject;
          if (!xNameObj[xValue]) xNameObj[xValue] = {};
          lastHash = xNameObj;
          lastXValue = xValue;
          data = xNameObj[xValue] as JsonObject;
        }
        lastHash[lastXValue] = "";
      }
    }

    // Fill in values
    for (const [xv, yv, value] of values) {
      const key = yv.join("-");
      if (!recordsMap.has(key)) {
        recordsMap.set(key, {});
      }
      const rec = recordsMap.get(key)!;

      // Set y field values
      for (let idx = 0; idx < yfields.length; idx++) {
        rec[yfields[idx]!] = yv[idx]!;
      }

      // Navigate to the right spot for the x value
      let data: JsonObject = rec;
      let lastHash: JsonObject = data;
      let lastXValue = "";

      for (let idx = 0; idx < xfields.length; idx++) {
        const xName = xfields[idx]!;
        const xValue = xv[idx]!;

        if (!data[xName]) data[xName] = {};
        const xNameObj = data[xName] as JsonObject;
        if (!xNameObj[xValue]) xNameObj[xValue] = {};
        lastHash = xNameObj;
        lastXValue = xValue;
        data = xNameObj[xValue] as JsonObject;
      }
      lastHash[lastXValue] = value;
    }

    // Output records in y-value order
    for (const yv of orderedYValues) {
      const key = yv.join("-");
      const rec = recordsMap.get(key);
      if (rec) {
        this.pushRecord(new Record(rec));
      }
    }
  }

  override doesRecordOutput(): boolean {
    return this.outputRecords;
  }

  override usage(): string {
    return `Usage: recs toptable <args> [<files>]
   Creates a multi-dimensional pivot table with any number of x and y axes.

Arguments:
  --x-field|-x         Add an x field (column axis)
  --y-field|-y         Add a y field (row axis)
  --v-field|-v         Specify the value to display
  --pin                Pin a field to a value (field=value)
  --sort               Sort specifications for x/y values
  --noheaders          Do not print row and column headers
  --records|--recs     Output records instead of table
  --sort-all-to-end    Sort ALL fields to the end

Examples:
  # Collate and display in a nice table
  ... | recs collate --key state,priority -a count | recs toptable --x state --y priority

  # Display left over field names as columns
  ... | recs toptable --x state,FIELD --y priority`;
  }
}

function formatTableRow(
  widths: number[],
  cellFn: (index: number, width: number) => string,
  delim: string
): string {
  let s = delim;
  for (let i = 0; i < widths.length; i++) {
    let cell = cellFn(i, widths[i]!);
    cell += " ".repeat(Math.max(0, widths[i]! - displayWidth(cell)));
    s += cell + delim;
  }
  return s;
}

function toptableFullHelp(): string {
  return `TOPTABLE FULL HELP:

OVERVIEW:
  Toptable (also known as "pivot table") creates a cross-tabulation of your
  data. It takes records with categorical fields and displays them as a
  2D grid where X fields form columns and Y fields form rows.

  Toptable is typically used after recs collate to visualize aggregated data.

BASIC USAGE:
  The simplest usage requires --x (column) and --y (row) fields:

    recs collate -k state,priority -a count \\
      | recs toptable --x state --y priority

  This produces a table like:
    +--------+-----+----+------+-----+
    |        |state|CA  |NY    |TX   |
    +--------+-----+----+------+-----+
    |priority|     |    |      |     |
    +--------+-----+----+------+-----+
    |high    |     |10  |15    |8    |
    +--------+-----+----+------+-----+
    |low     |     |25  |30    |20   |
    +--------+-----+----+------+-----+

THE FIELD PSEUDO-VALUE:
  The special value "FIELD" is powerful: it uses unused field names
  themselves as values in the table. This is useful when you have multiple
  value fields and want each to appear as a separate column or row.

  Example: You have records with count and sum_rss fields:
    recs collate -k priority -a count -a sum,rss \\
      | recs toptable --x FIELD --y priority

  This creates columns for "count" and "sum_rss" automatically:
    +--------+-----+-----+-------+
    |        |FIELD|count|sum_rss|
    +--------+-----+-----+-------+
    |priority|     |     |       |
    +--------+-----+-----+-------+
    |high    |     |33   |45000  |
    +--------+-----+-----+-------+
    |low     |     |75   |98000  |
    +--------+-----+-----+-------+

MULTI-DIMENSIONAL TABLES:
  You can specify multiple --x and --y fields to create higher-dimensional
  tables. Headers are deduplicated when adjacent values repeat.

    recs toptable --x state --x FIELD --y priority

VALUE FIELDS:
  By default, toptable auto-detects value fields as any field not used as
  an x, y, or pin field. You can explicitly specify value fields with -v:

    recs toptable --x state --y priority --v count

  This is useful when you have many aggregated fields but only want to
  display one.

PINNING:
  Use --pin to filter records to a specific value before building the table:

    recs toptable --x state --y priority --pin region=west

  You can also pin on FIELD to show only specific value fields:

    recs toptable --x state --y priority --pin FIELD=count

SORTING:
  By default, x and y values appear in insertion order (the order they
  are first seen in the input). Use --sort to control the order:

    recs toptable --x state --y priority --sort state

  Use --sort-all-to-end (--sa) to sort "ALL" values to the end in cube
  output.

RECORD OUTPUT:
  Use --records (--recs) to output records instead of a formatted table.
  Each row of the table becomes a record, with x-field values as nested
  keys:

    recs toptable --x state --y priority --records

  Output records look like:
    {"priority":"high","state":{"CA":"10","NY":"15","TX":"8"}}

COMMON PATTERNS:
  Quick summary table:
    recs collate -k x_field -a count | recs toptable --x x_field --y FIELD

  Two-axis pivot:
    recs collate -k dept,quarter -a sum,revenue \\
      | recs toptable --x quarter --y dept

  Multiple metrics side by side:
    recs collate -k host -a count -a avg,latency -a max,latency \\
      | recs toptable --x FIELD --y host

  Cube rollup with sorted ALL:
    recs collate --cube -k region,product -a sum,sales \\
      | recs toptable --x region --y product --sa
`;
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "toptable",
  category: "output",
  synopsis: "recs toptable [options] [files...]",
  description:
    "Creates a multi-dimensional pivot table with any number of x and y axes. X and Y fields can take the special value 'FIELD' which uses unused field names as values for the FIELD dimension.",
  options: [
    {
      flags: ["--x-field", "-x"],
      argument: "<field>",
      description:
        "Add an x field (column axis). Values of the specified field will become columns in the table. May be a keyspec or a keygroup.",
    },
    {
      flags: ["--y-field", "-y"],
      argument: "<field>",
      description:
        "Add a y field (row axis). Values of the specified field will become rows in the table. May be a keyspec or a keygroup.",
    },
    {
      flags: ["--v-field", "-v"],
      argument: "<field>",
      description:
        "Specify the value field to display in the table. If multiple value fields are specified and FIELD is not placed in the x or y axes, then the last one wins. May be a keyspec or a keygroup.",
    },
    {
      flags: ["--pin", "-p"],
      argument: "<field=value>",
      description:
        "Pin a field to a certain value, only display records matching that value. Takes value of the form: field=pinnedValue.",
    },
    {
      flags: ["--sort"],
      argument: "<sort spec>",
      description:
        "Sort specifications for x/y values in headers. See recs sort --help for details of sort specifications.",
    },
    {
      flags: ["--noheaders"],
      description: "Do not print row and column headers.",
    },
    {
      flags: ["--records", "--recs"],
      description: "Instead of printing a table, output records, one per row of the table.",
    },
    {
      flags: ["--sort-all-to-end", "--sa"],
      description:
        "Sort ALL fields to the end, equivalent to --sort FIELD=* for each --x and --y field.",
    },
  ],
  examples: [
    {
      description: "Collate and display in a nice table",
      command:
        "... | recs collate --key state,priority -a count | recs toptable --x state --y priority",
    },
    {
      description: "Display left over field names as columns",
      command:
        "... | recs collate --key state,priority -a count -a sum,rss | recs toptable --x state,FIELD --y priority",
    },
    {
      description: "Specify the displayed cell values",
      command:
        "... | recs collate --key state,priority -a count -a sum,rss | recs toptable --x state,FIELD --y priority --v sum_rss",
    },
  ],
  seeAlso: ["collate", "totable"],
};
