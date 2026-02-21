import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { setKey } from "../../KeySpec.ts";

/**
 * Split lines on a delimiter into records.
 *
 * Analogous to App::RecordStream::Operation::fromsplit in Perl.
 */
export class FromSplit extends Operation {
  private fields: string[] = [];
  private delimiter = ",";
  private header = false;
  private strict = false;
  private extraArgs: string[] = [];

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => {
          this.fields.push(...(v as string).split(","));
        },
        description: "Comma separated list of key names",
      },
      {
        long: "field",
        short: "f",
        type: "string",
        handler: (v) => {
          this.fields.push(...(v as string).split(","));
        },
        description: "Comma separated list of key names",
      },
      {
        long: "delim",
        short: "d",
        type: "string",
        handler: (v) => {
          this.delimiter = v as string;
        },
        description: "Delimiter for splitting (default ',')",
      },
      {
        long: "header",
        type: "boolean",
        handler: () => {
          this.header = true;
        },
        description: "Take key names from the first line of input",
      },
      {
        long: "strict",
        type: "boolean",
        handler: () => {
          this.strict = true;
        },
        description: "Delimiter is not treated as a regex",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);
  }

  acceptRecord(_record: Record): boolean {
    return true;
  }

  override wantsInput(): boolean {
    return this.extraArgs.length === 0;
  }

  override streamDone(): void {
    if (this.extraArgs.length > 0) {
      for (const file of this.extraArgs) {
        this.updateCurrentFilename(file);
        const content = readFileSync(file);
        for (const line of content.split("\n")) {
          if (line === "") continue;
          this.processLine(line);
        }
      }
    }
  }

  processLine(line: string): void {
    if (this.header) {
      const values = this.splitLine(line);
      this.fields.push(...values);
      this.header = false;
      return;
    }

    const values = this.splitLine(line);
    const record = new Record();
    const data = record.dataRef();

    for (let i = 0; i < values.length; i++) {
      const key = this.fields[i] ?? String(i);
      setKey(data, key, values[i]!);
    }

    this.pushRecord(record);
  }

  override acceptLine(line: string): boolean {
    this.processLine(line);
    return true;
  }

  private splitLine(line: string): string[] {
    if (this.strict) {
      // Literal split using escapeRegex
      return line.split(this.delimiter);
    } else {
      // Treat delimiter as regex
      const regex = new RegExp(this.delimiter);
      return line.split(regex);
    }
  }
}

function readFileSync(path: string): string {
  const fs = require("node:fs") as typeof import("node:fs");
  return fs.readFileSync(path, "utf-8");
}
