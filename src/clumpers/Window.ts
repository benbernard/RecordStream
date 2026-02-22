import type { Clumper, ClumperCallback } from "../Clumper.ts";
import { clumperRegistry } from "../Clumper.ts";
import type { Record } from "../Record.ts";

interface WindowState {
  window: Record[];
}

export class WindowClumper implements Clumper {
  size: number;

  constructor(size: string) {
    this.size = Number(size);
  }

  acceptRecord(record: Record, callback: ClumperCallback, cookie: unknown): void {
    const state = cookie as WindowState;
    state.window.push(record);

    if (state.window.length > this.size) {
      state.window.shift();
    }

    if (state.window.length >= this.size) {
      const groupCookie = callback.clumperCallbackBegin({});
      for (const rec of state.window) {
        callback.clumperCallbackPushRecord(groupCookie, rec);
      }
      callback.clumperCallbackEnd(groupCookie);
    }
  }

  streamDone(_callback: ClumperCallback, _cookie: unknown): void {
    // Window clumper doesn't emit partial windows at the end
  }
}

export function makeWindowInitialState(): WindowState {
  return { window: [] };
}

clumperRegistry.register("window", {
  create: (size: string) => new WindowClumper(size),
  argCounts: [1],
  shortUsage: "clump records by a rolling window",
  longUsage: "Usage: window,<size>\n   Clump records by a rolling window of size <size>.",
});
