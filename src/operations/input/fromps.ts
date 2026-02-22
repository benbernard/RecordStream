import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import type { JsonObject, JsonValue } from "../../types/json.ts";

/**
 * Interface for process table data source.
 * Allows mocking in tests.
 */
export interface ProcessTableSource {
  getProcesses(): JsonObject[];
  getFields(): string[];
}

/**
 * Default process table source that shells out to `ps`.
 */
class PsProcessTable implements ProcessTableSource {
  getProcesses(): JsonObject[] {
    const result = Bun.spawnSync(["ps", "aux"]);
    if (!result.success) {
      throw new Error(`ps command failed: ${result.stderr.toString()}`);
    }

    const output = result.stdout.toString();
    const lines = output.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) return [];

    // Parse header line
    const header = lines[0]!;
    const headerFields = header.trim().split(/\s+/);

    const processes: JsonObject[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      const parts = line.trim().split(/\s+/);
      const record: JsonObject = {};

      // The last field (COMMAND) may contain spaces
      for (let j = 0; j < headerFields.length; j++) {
        const fieldName = headerFields[j]!.toLowerCase();
        if (j === headerFields.length - 1) {
          // Last field gets remaining text
          record[fieldName] = parts.slice(j).join(" ");
        } else {
          record[fieldName] = parts[j] ?? "";
        }
      }

      processes.push(record);
    }

    return processes;
  }

  getFields(): string[] {
    const result = Bun.spawnSync(["ps", "aux"]);
    if (!result.success) return [];
    const output = result.stdout.toString();
    const lines = output.split("\n");
    if (lines.length === 0) return [];
    return lines[0]!
      .trim()
      .split(/\s+/)
      .map((f) => f.toLowerCase());
  }
}

/**
 * Generate records from the process table.
 *
 * Analogous to App::RecordStream::Operation::fromps in Perl.
 */
export class FromPs extends Operation {
  fields: string[] = [];
  processTable: ProcessTableSource = new PsProcessTable();
  uidConverter: ((uid: JsonValue) => string) | null = null;

  acceptRecord(_record: Record): boolean {
    return true;
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
        description: "Fields to output",
      },
      {
        long: "field",
        short: "f",
        type: "string",
        handler: (v) => {
          this.fields.push(...(v as string).split(","));
        },
        description: "Fields to output",
      },
    ];

    this.parseOptions(args, defs);

    if (this.fields.length === 0) {
      this.fields = this.processTable.getFields();
    }
  }

  setProcessTable(table: ProcessTableSource): void {
    this.processTable = table;
  }

  setUidConverter(converter: (uid: JsonValue) => string): void {
    this.uidConverter = converter;
  }

  override wantsInput(): boolean {
    return false;
  }

  override streamDone(): void {
    const processes = this.processTable.getProcesses();

    for (const proc of processes) {
      const record = new Record();
      for (const field of this.fields) {
        let value = proc[field];
        if (value === undefined) continue;

        if (field === "uid" && this.uidConverter) {
          value = this.uidConverter(value);
        }

        record.set(field, value);
      }
      this.pushRecord(record);
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromps",
  category: "input",
  synopsis: "recs fromps [options]",
  description:
    "Generate records from the process table. Prints out JSON records converted from the process table. Fields default to all available fields from ps.",
  options: [
    {
      flags: ["--key", "-k"],
      argument: "<fields>",
      description:
        "Fields to output. May be specified multiple times, may be comma separated. Defaults to all fields.",
    },
    {
      flags: ["--field", "-f"],
      argument: "<fields>",
      description:
        "Fields to output. May be specified multiple times, may be comma separated. Defaults to all fields.",
    },
  ],
  examples: [
    {
      description: "Get records for the process table",
      command: "recs fromps",
    },
    {
      description: "Only get uid and pid",
      command: "recs fromps --key uid,pid",
    },
  ],
};
