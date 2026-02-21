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

  override streamDone(): void {
    if (this.extraArgs.length > 0) {
      for (const file of this.extraArgs) {
        this.updateCurrentFilename(file);
        const content = readFileSync(file);
        this.parseContent(content);
      }
    } else {
      // For programmatic use, stdin should be passed as content
      // In CLI mode, stdin will be handled by the dispatcher
    }
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

function readFileSync(path: string): string {
  const fs = require("node:fs") as typeof import("node:fs");
  return fs.readFileSync(path, "utf-8");
}
