import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { findKey } from "../../KeySpec.ts";
import type { JsonObject, JsonArray } from "../../types/json.ts";

/**
 * Import JSON objects from within a JSON array.
 *
 * Analogous to App::RecordStream::Operation::fromjsonarray in Perl.
 */
export class FromJsonArray extends Operation {
  fields: string[] = [];
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
        description: "Optional comma separated list of field names to extract",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);
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
    }
  }

  parseContent(content: string): void {
    const parsed: unknown = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      throw new Error("Expected a JSON array");
    }

    const arr = parsed as JsonArray;
    const hasFields = this.fields.length > 0;

    for (const item of arr) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        continue;
      }
      const itemObj = item as JsonObject;

      if (hasFields) {
        const record = new Record();
        for (const field of this.fields) {
          const value = findKey(itemObj, field, true) ?? null;
          // Use literal field spec as the output key name (not nested path)
          record.set(field, value);
        }
        this.pushRecord(record);
      } else {
        this.pushRecord(new Record(itemObj));
      }
    }
  }
}

function readFileSync(path: string): string {
  const fs = require("node:fs") as typeof import("node:fs");
  return fs.readFileSync(path, "utf-8");
}
