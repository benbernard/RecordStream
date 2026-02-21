import type { Clumper, ClumperCallback } from "../Clumper.ts";
import { clumperRegistry } from "../Clumper.ts";
import type { Record } from "../Record.ts";
import { findKey } from "../KeySpec.ts";

interface KeyAdjacentState {
  currentValue: string | null;
  currentCookie: unknown;
}

export class KeyAdjacentClumper implements Clumper {
  field: string;

  constructor(field: string) {
    this.field = field;
  }

  acceptRecord(record: Record, callback: ClumperCallback, cookie: unknown): void {
    const state = cookie as KeyAdjacentState;
    const rawValue = findKey(record.dataRef(), this.field, true);
    const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);

    if (state.currentValue !== value) {
      // Close previous group
      if (state.currentValue !== null) {
        callback.clumperCallbackEnd(state.currentCookie);
      }
      // Start new group
      state.currentValue = value;
      state.currentCookie = callback.clumperCallbackBegin({ key: this.field, value });
    }

    callback.clumperCallbackPushRecord(state.currentCookie, record);
  }

  streamDone(callback: ClumperCallback, cookie: unknown): void {
    const state = cookie as KeyAdjacentState;
    if (state.currentValue !== null) {
      callback.clumperCallbackEnd(state.currentCookie);
    }
  }
}

export function makeKeyAdjacentInitialState(): KeyAdjacentState {
  return { currentValue: null, currentCookie: undefined };
}

clumperRegistry.register("key", {
  create: (field: string) => new KeyAdjacentClumper(field),
  argCounts: [1],
  shortUsage: "clump records by adjacent key values",
  longUsage: "Usage: key,<keyspec>\n   Clump records by adjacent matching key values.",
});
