import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { setKey } from "../../KeySpec.ts";
import Papa from "papaparse";

/**
 * Parse CSV input into records.
 *
 * Analogous to App::RecordStream::Operation::fromcsv in Perl.
 */
export class FromCsv extends Operation {
  fields: string[] = [];
  headerLine = false;
  strict = false;
  delim = ",";
  escape = '"';
  quote: string | false = '"';
  extraArgs: string[] = [];

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
  }

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
        long: "header",
        type: "boolean",
        handler: () => {
          this.headerLine = true;
        },
        description: "Take field names from the first line of input",
      },
      {
        long: "strict",
        type: "boolean",
        handler: () => {
          this.strict = true;
        },
        description: "Do not trim whitespace or allow loose quoting",
      },
      {
        long: "delim",
        short: "d",
        type: "string",
        handler: (v) => {
          this.delim = v as string;
        },
        description: "Field delimiter (default ',')",
      },
      {
        long: "escape",
        type: "string",
        handler: (v) => {
          this.escape = v as string;
        },
        description: "Escape character (default '\"')",
      },
      {
        long: "quote",
        type: "string",
        handler: (v) => {
          const s = v as string;
          this.quote = s === "" ? false : s;
        },
        description: "Quote character (default '\"')",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (this.delim.length !== 1) {
      throw new Error("Delimiter must be a single character");
    }
  }

  acceptRecord(_record: Record): boolean {
    return true;
  }

  override wantsInput(): boolean {
    return false;
  }

  /**
   * Parse CSV content and push records.
   * This is the main entry point for both file and stdin processing.
   */
  parseContent(content: string): void {
    const fields = [...this.fields];
    let headerConsumed = false;

    const result = Papa.parse(content, {
      delimiter: this.delim,
      quoteChar: this.quote === false ? undefined : this.quote,
      escapeChar: this.escape,
      skipEmptyLines: true,
      // Papa uses trimHeaders but we want to trim cell values in non-strict mode
    });

    if (result.errors.length > 0 && this.strict) {
      const err = result.errors[0]!;
      throw new Error(
        `fromcsv: parse error: ${err.message}, roughly at position ${err.index ?? 0}, line ${err.row !== undefined ? err.row + 1 : 0}, file ${this.getCurrentFilename()}`
      );
    }

    for (const row of result.data as string[][]) {
      if (this.headerLine && !headerConsumed) {
        fields.push(...row);
        headerConsumed = true;
        continue;
      }

      const values = this.strict ? row : row.map((v) => v.trim());
      const record = new Record();
      const data = record.dataRef();

      for (let i = 0; i < values.length; i++) {
        const key = fields[i] ?? String(i);
        setKey(data, key, values[i]!);
      }

      this.pushRecord(record);
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromcsv",
  category: "input",
  synopsis: "recs fromcsv [options] [<files>]",
  description:
    "Each line of input (or lines of <files>) is split on commas to produce an output record. Fields are named numerically (0, 1, etc.), or as given by --key, or as read by --header. Lines may be split on delimiters other than commas by providing --delim.",
  options: [
    {
      flags: ["--key", "-k"],
      argument: "<keys>",
      description:
        "Comma separated list of field names. May be specified multiple times, may be key specs.",
    },
    {
      flags: ["--field", "-f"],
      argument: "<keys>",
      description:
        "Comma separated list of field names. May be specified multiple times, may be key specs.",
    },
    {
      flags: ["--header"],
      description: "Take field names from the first line of input.",
    },
    {
      flags: ["--strict"],
      description:
        "Do not trim whitespace, allow loose quoting (quotes inside quotes), or allow the use of escape characters when not strictly needed.",
    },
    {
      flags: ["--delim", "-d"],
      argument: "<character>",
      description: "Field delimiter to use when reading input lines (default ',').",
    },
    {
      flags: ["--escape"],
      argument: "<character>",
      description: "Escape character used in quoted fields (default '\"').",
    },
    {
      flags: ["--quote"],
      argument: "<character>",
      description:
        "Quote character used in quoted fields (default '\"'). Use the empty string to indicate no quoted fields.",
    },
  ],
  examples: [
    {
      description: "Parse csv separated fields x and y",
      command: "recs fromcsv --field x,y",
    },
    {
      description: "Parse data with a header line specifying fields",
      command: "recs fromcsv --header",
    },
    {
      description: "Parse tsv data (using bash syntax for a literal tab)",
      command: "recs fromcsv --delim $'\\t'",
    },
  ],
  seeAlso: ["fromsplit", "fromre"],
};
