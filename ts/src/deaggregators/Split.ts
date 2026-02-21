import { FieldDeaggregator } from "./Field.ts";
import { deaggregatorRegistry } from "../Deaggregator.ts";
import type { JsonValue } from "../types/json.ts";

function makeDelim(delim: string): RegExp {
  const regexMatch = delim.match(/^\/(.*)\/([i]?)$/);
  if (regexMatch) {
    return new RegExp(regexMatch[1]!, regexMatch[2]);
  }
  // Escape for literal matching
  return new RegExp(delim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

export class SplitDeaggregator extends FieldDeaggregator {
  private delim: RegExp;
  private newField: string;

  constructor(oldField: string, delim: string, newField: string) {
    super(oldField);
    this.delim = makeDelim(delim);
    this.newField = newField;
  }

  protected deaggregateField(value: JsonValue | undefined): { [key: string]: JsonValue }[] {
    if (value === undefined || value === null) return [];
    const parts = String(value).split(this.delim);
    return parts.map((part) => ({ [this.newField]: part }));
  }
}

deaggregatorRegistry.register("split", {
  create: (oldField: string, delim: string, newField: string) =>
    new SplitDeaggregator(oldField, delim, newField),
  argCounts: [3],
  shortUsage: "split the provided field",
  longUsage: "Usage: split,<old field>,<delimiter>,<new field>\n   Split the old field to create a new one.",
});
