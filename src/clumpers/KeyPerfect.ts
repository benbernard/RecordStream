import type { Clumper, ClumperCallback } from "../Clumper.ts";
import { clumperRegistry } from "../Clumper.ts";
import type { Record } from "../Record.ts";
import { findKey } from "../KeySpec.ts";

interface KeyPerfectState {
  order: string[];
  groups: Map<string, unknown>;
}

export class KeyPerfectClumper implements Clumper {
  field: string;

  constructor(field: string) {
    this.field = field;
  }

  getValues(value: string): string[] {
    return [value];
  }

  acceptRecord(record: Record, callback: ClumperCallback, cookie: unknown): void {
    const state = cookie as KeyPerfectState;
    const rawValue = findKey(record.dataRef(), this.field, true);
    const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);

    for (const v of this.getValues(value)) {
      let groupCookie = state.groups.get(v);
      if (groupCookie === undefined) {
        state.order.push(v);
        groupCookie = callback.clumperCallbackBegin({ key: this.field, value: v });
        state.groups.set(v, groupCookie);
      }
      callback.clumperCallbackPushRecord(groupCookie, record);
      state.groups.set(v, groupCookie);
    }
  }

  streamDone(callback: ClumperCallback, cookie: unknown): void {
    const state = cookie as KeyPerfectState;
    for (const v of state.order) {
      const groupCookie = state.groups.get(v);
      callback.clumperCallbackEnd(groupCookie);
    }
  }
}

export function makeKeyPerfectInitialState(): KeyPerfectState {
  return { order: [], groups: new Map() };
}

clumperRegistry.register("keyperfect", {
  create: (field: string) => new KeyPerfectClumper(field),
  argCounts: [1],
  shortUsage: "clump records by the value for a key",
  longUsage: "Usage: keyperfect,<keyspec>\n   Clump records by the value for a key",
});
