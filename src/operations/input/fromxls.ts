import { readFileSync } from "node:fs";
import { read, utils } from "xlsx";
import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { setKey } from "../../KeySpec.ts";

/**
 * Parse Excel files (xls, xlsx) into records.
 * Each row becomes a record with field names taken from headers or numeric indices.
 */
export class FromXls extends Operation {
  fields: string[] = [];
  headerLine = true;
  sheet: string | null = null;
  allSheets = false;
  extraArgs: string[] = [];

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => {
          this.fields.push(...(v as string).split(","));
        },
        description: "Comma separated list of field names",
      },
      {
        long: "field",
        short: "f",
        type: "string",
        handler: (v) => {
          this.fields.push(...(v as string).split(","));
        },
        description: "Comma separated list of field names",
      },
      {
        long: "no-header",
        short: "n",
        type: "boolean",
        handler: () => { this.headerLine = false; },
        description: "Do not treat the first row as a header line",
      },
      {
        long: "sheet",
        short: "s",
        type: "string",
        handler: (v) => { this.sheet = v as string; },
        description: "Sheet name to read (defaults to first sheet)",
      },
      {
        long: "all-sheets",
        type: "boolean",
        handler: () => { this.allSheets = true; },
        description: "Read all sheets, adding a 'sheet' field to each record",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (this.extraArgs.length === 0) {
      throw new Error("fromxls requires at least one file argument");
    }
  }

  acceptRecord(_record: Record): boolean {
    return true;
  }

  override wantsInput(): boolean {
    return false;
  }

  override streamDone(): void {
    for (const file of this.extraArgs) {
      this.updateCurrentFilename(file);
      this.parseFile(file);
    }
  }

  parseFile(file: string): void {
    const buffer = readFileSync(file);
    const workbook = read(buffer, { type: "buffer" });

    const sheetNames = this.allSheets
      ? workbook.SheetNames
      : [this.sheet ?? workbook.SheetNames[0]!];

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error(`Sheet '${sheetName}' not found in ${file}`);
      }

      const rows = utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as string[][];

      if (rows.length === 0) continue;

      let fields = [...this.fields];
      let startRow = 0;

      if (this.headerLine && fields.length === 0) {
        fields = rows[0]!.map((v) => String(v).trim());
        startRow = 1;
      }

      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i]!;
        // Skip entirely empty rows
        if (row.every((v) => String(v).trim() === "")) continue;

        const record = new Record();
        const data = record.dataRef();

        for (let j = 0; j < row.length; j++) {
          const key = fields[j] ?? String(j);
          const val = String(row[j] ?? "");
          // Try to parse numbers
          const num = Number(val);
          if (val !== "" && !isNaN(num) && isFinite(num)) {
            setKey(data, key, num);
          } else {
            setKey(data, key, val);
          }
        }

        if (this.allSheets) {
          setKey(data, "sheet", sheetName);
        }

        this.pushRecord(record);
      }
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromxls",
  category: "input",
  synopsis: "recs fromxls [options] <files...>",
  description:
    "Parse Excel files (xls, xlsx, xlsb, xlsm) into records. " +
    "By default, reads the first sheet and uses the first row as header names.",
  options: [
    {
      flags: ["--key", "-k"],
      argument: "<keys>",
      description:
        "Comma separated list of field names. Overrides header detection.",
    },
    {
      flags: ["--field", "-f"],
      argument: "<keys>",
      description:
        "Comma separated list of field names. Overrides header detection.",
    },
    {
      flags: ["--no-header", "-n"],
      description:
        "Do not treat the first row as a header. Fields will be named numerically (0, 1, 2, ...).",
    },
    {
      flags: ["--sheet", "-s"],
      argument: "<name>",
      description:
        "Specify a sheet name to read. Defaults to the first sheet.",
    },
    {
      flags: ["--all-sheets"],
      description:
        "Read all sheets in the workbook, adding a 'sheet' field to each record.",
    },
  ],
  examples: [
    {
      description: "Read an Excel file using headers from the first row",
      command: "recs fromxls data.xlsx",
    },
    {
      description: "Read a specific sheet without headers",
      command: "recs fromxls --sheet 'Sheet2' --no-header -k name,value data.xlsx",
    },
    {
      description: "Read all sheets",
      command: "recs fromxls --all-sheets data.xlsx",
    },
  ],
  seeAlso: ["fromcsv"],
};
