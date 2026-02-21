import type { Deaggregator } from "../Deaggregator.ts";
import type { Record as Rec } from "../Record.ts";
import { findKey } from "../KeySpec.ts";
import type { JsonValue } from "../types/json.ts";

export abstract class FieldDeaggregator implements Deaggregator {
  protected field: string;

  constructor(field: string) {
    this.field = field;
  }

  deaggregate(record: Rec): Rec[] {
    const value = findKey(record.dataRef(), this.field, true);
    const newPairs = this.deaggregateField(value);
    return newPairs.map((pair) => {
      const base = record.clone();
      for (const [k, v] of Object.entries(pair)) {
        base.set(k, v);
      }
      return base;
    });
  }

  protected abstract deaggregateField(
    value: JsonValue | undefined
  ): { [key: string]: JsonValue }[];
}
