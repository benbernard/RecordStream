import type { Clumper, ClumperCallback } from "../Clumper.ts";
import { clumperRegistry } from "../Clumper.ts";
import type { Record } from "../Record.ts";
import { findKey } from "../KeySpec.ts";

interface LRUEntry {
  key: string;
  cookie: unknown;
  prev: LRUEntry | null;
  next: LRUEntry | null;
}

interface LRUState {
  map: Map<string, LRUEntry>;
  head: LRUEntry | null;
  tail: LRUEntry | null;
}

function lruTouch(state: LRUState, entry: LRUEntry): void {
  // Remove from current position
  if (entry.prev) entry.prev.next = entry.next;
  if (entry.next) entry.next.prev = entry.prev;
  if (state.head === entry) state.head = entry.next;
  if (state.tail === entry) state.tail = entry.prev;

  // Add to tail (most recently used)
  entry.prev = state.tail;
  entry.next = null;
  if (state.tail) state.tail.next = entry;
  state.tail = entry;
  if (!state.head) state.head = entry;
}

function lruPurge(state: LRUState, maxSize: number, callback: ClumperCallback): void {
  while (state.map.size > maxSize && state.head) {
    const entry = state.head;
    state.head = entry.next;
    if (state.head) state.head.prev = null;
    if (state.tail === entry) state.tail = null;
    state.map.delete(entry.key);
    callback.clumperCallbackEnd(entry.cookie);
  }
}

export class KeyLRUClumper implements Clumper {
  field: string;
  size: number;

  constructor(field: string, size: string) {
    this.field = field;
    this.size = Number(size);
  }

  acceptRecord(record: Record, callback: ClumperCallback, cookie: unknown): void {
    const state = cookie as LRUState;
    const rawValue = findKey(record.dataRef(), this.field, true);
    const value = rawValue === undefined || rawValue === null ? "" : String(rawValue);

    let entry = state.map.get(value);
    if (!entry) {
      const groupCookie = callback.clumperCallbackBegin({ key: this.field, value });
      entry = { key: value, cookie: groupCookie, prev: null, next: null };
      state.map.set(value, entry);
      // Add to tail
      entry.prev = state.tail;
      if (state.tail) state.tail.next = entry;
      state.tail = entry;
      if (!state.head) state.head = entry;
    } else {
      lruTouch(state, entry);
    }

    callback.clumperCallbackPushRecord(entry.cookie, record);
    lruPurge(state, this.size, callback);
  }

  streamDone(callback: ClumperCallback, cookie: unknown): void {
    const state = cookie as LRUState;
    lruPurge(state, 0, callback);
  }
}

export function makeKeyLRUInitialState(): LRUState {
  return { map: new Map(), head: null, tail: null };
}

clumperRegistry.register("keylru", {
  create: (field: string, size: string) => new KeyLRUClumper(field, size),
  argCounts: [2],
  shortUsage: "clump records by the value for a key, limiting number of active clumps",
  longUsage: "Usage: keylru,<keyspec>,<size>\n   Clump records by the value for a key, limiting number of active clumps to <size>",
});
