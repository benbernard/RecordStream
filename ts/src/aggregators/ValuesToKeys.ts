import type { Aggregator } from "../Aggregator.ts";
import type { Record } from "../Record.ts";
import type { JsonValue, JsonObject } from "../types/json.ts";
import { findKey } from "../KeySpec.ts";
import { aggregatorRegistry } from "../Aggregator.ts";

export class ValuesToKeysAggregator implements Aggregator<JsonObject | null> {
  private keyField: string;
  private valueField: string;

  constructor(keyField: string, valueField: string) {
    this.keyField = keyField;
    this.valueField = valueField;
  }

  initial(): JsonObject | null {
    return null;
  }

  combine(state: JsonObject | null, record: Record): JsonObject | null {
    const key = findKey(record.dataRef(), this.keyField, true);
    const value = findKey(record.dataRef(), this.valueField, true);
    if (key === undefined || key === null) return state;
    const mapped: JsonObject = { [String(key)]: value ?? null };
    if (state === null) return mapped;
    Object.assign(state, mapped);
    return state;
  }

  squish(state: JsonObject | null): JsonValue {
    return state ?? {};
  }
}

aggregatorRegistry.register("valuestokeys", {
  create: (keyField: string, valueField: string) => new ValuesToKeysAggregator(keyField, valueField),
  argCounts: [2],
  shortUsage: "use one key-value as a key for a different value in the record",
  longUsage: "Usage: valuestokeys,<keyfield>,<valuefield>\n  Take the specified keyfield, use its value as the key for the value of value field.",
  aliases: ["vk"],
});
