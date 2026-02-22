import { FieldDeaggregator } from "./Field.ts";
import { deaggregatorRegistry } from "../Deaggregator.ts";
import type { JsonValue, JsonArray } from "../types/json.ts";

export class UnarrayDeaggregator extends FieldDeaggregator {
  newField: string;

  constructor(oldField: string, newField: string) {
    super(oldField);
    this.newField = newField;
  }

  deaggregateField(value: JsonValue | undefined): { [key: string]: JsonValue }[] {
    if (!Array.isArray(value)) return [];
    return (value as JsonArray).map((item) => ({ [this.newField]: item }));
  }
}

deaggregatorRegistry.register("unarray", {
  create: (oldField: string, newField: string) =>
    new UnarrayDeaggregator(oldField, newField),
  argCounts: [2],
  shortUsage: "split the provided array",
  longUsage: "Usage: unarray,<old field>,<new field>\n   Split the array into individual \"element\" records.",
});
