import { FieldDeaggregator } from "./Field.ts";
import { deaggregatorRegistry } from "../Deaggregator.ts";
import type { JsonValue, JsonObject } from "../types/json.ts";

export class UnhashDeaggregator extends FieldDeaggregator {
  private newKeyField: string;
  private newValueField: string | null;

  constructor(oldField: string, newKeyField: string, newValueField?: string) {
    super(oldField);
    this.newKeyField = newKeyField;
    this.newValueField = newValueField ?? null;
  }

  protected deaggregateField(value: JsonValue | undefined): { [key: string]: JsonValue }[] {
    if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }
    const obj = value as JsonObject;
    const keys = Object.keys(obj).sort();
    return keys.map((key) => {
      const record: { [key: string]: JsonValue } = { [this.newKeyField]: key };
      if (this.newValueField !== null) {
        record[this.newValueField] = obj[key]!;
      }
      return record;
    });
  }
}

deaggregatorRegistry.register("unhash", {
  create: (oldField: string, newKeyField: string, newValueField?: string) =>
    new UnhashDeaggregator(oldField, newKeyField, newValueField),
  argCounts: [2, 3],
  shortUsage: "split the provided hash",
  longUsage: "Usage: unhash,<old field>,<new key field>[,<new value field>]\n   Split the hash into key/value \"pair\" records.",
});
