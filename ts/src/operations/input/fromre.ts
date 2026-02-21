import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { setKey } from "../../KeySpec.ts";

/**
 * Match regex against lines, capture groups become fields.
 *
 * Analogous to App::RecordStream::Operation::fromre in Perl.
 */
export class FromRe extends Operation {
  private fields: string[] = [];
  private pattern: RegExp | null = null;
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
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (this.extraArgs.length === 0) {
      throw new Error("Missing expression");
    }

    this.pattern = new RegExp(this.extraArgs.shift()!);
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
    if (!this.pattern) return;

    const match = this.pattern.exec(line);
    if (match) {
      const record = new Record();
      const data = record.dataRef();

      // Groups start at index 1
      for (let i = 1; i < match.length; i++) {
        const fieldIndex = i - 1;
        const key = this.fields[fieldIndex] ?? String(fieldIndex);
        setKey(data, key, match[i]!);
      }

      this.pushRecord(record);
    }
  }

  override acceptLine(line: string): boolean {
    this.processLine(line);
    return true;
  }
}

function readFileSync(path: string): string {
  const fs = require("node:fs") as typeof import("node:fs");
  return fs.readFileSync(path, "utf-8");
}
