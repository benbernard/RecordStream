import { describe, test, expect } from "bun:test";
import { Record } from "../../src/Record.ts";
import type { ClumperCallback } from "../../src/Clumper.ts";

// Import clumper implementations
import { KeyPerfectClumper, makeKeyPerfectInitialState } from "../../src/clumpers/KeyPerfect.ts";
import { CubeKeyPerfectClumper } from "../../src/clumpers/CubeKeyPerfect.ts";
import { KeyAdjacentClumper, makeKeyAdjacentInitialState } from "../../src/clumpers/Key.ts";
import { WindowClumper, makeWindowInitialState } from "../../src/clumpers/Window.ts";
import { KeyLRUClumper, makeKeyLRUInitialState } from "../../src/clumpers/KeyLRU.ts";

// Import to register
import "../../src/clumpers/KeyPerfect.ts";
import "../../src/clumpers/CubeKeyPerfect.ts";
import "../../src/clumpers/Key.ts";
import "../../src/clumpers/KeyLRU.ts";
import "../../src/clumpers/Window.ts";
import { clumperRegistry } from "../../src/Clumper.ts";

class TestCallback implements ClumperCallback {
  groups: Record[][] = [];
  current: Record[] | null = null;

  clumperCallbackBegin(_options: { [key: string]: unknown }): unknown {
    this.current = [];
    return this.current;
  }

  clumperCallbackPushRecord(cookie: unknown, record: Record): void {
    (cookie as Record[]).push(record);
  }

  clumperCallbackEnd(cookie: unknown): void {
    this.groups.push(cookie as Record[]);
    this.current = null;
  }
}

describe("KeyPerfect clumper", () => {
  test("groups records by key", () => {
    const clumper = new KeyPerfectClumper("color");
    const cb = new TestCallback();
    const cookie = makeKeyPerfectInitialState();

    const records = [
      new Record({ color: "red", val: 1 }),
      new Record({ color: "blue", val: 2 }),
      new Record({ color: "red", val: 3 }),
      new Record({ color: "blue", val: 4 }),
    ];

    for (const rec of records) {
      clumper.acceptRecord(rec, cb, cookie);
    }
    clumper.streamDone(cb, cookie);

    expect(cb.groups).toHaveLength(2);
    expect(cb.groups[0]).toHaveLength(2); // red
    expect(cb.groups[1]).toHaveLength(2); // blue
  });

  test("is registered", () => {
    expect(clumperRegistry.has("keyperfect")).toBe(true);
  });
});

describe("CubeKeyPerfect clumper", () => {
  test("groups records with ALL slice", () => {
    const clumper = new CubeKeyPerfectClumper("color");
    const cb = new TestCallback();
    const cookie = makeKeyPerfectInitialState();

    const records = [
      new Record({ color: "red", val: 1 }),
      new Record({ color: "blue", val: 2 }),
    ];

    for (const rec of records) {
      clumper.acceptRecord(rec, cb, cookie);
    }
    clumper.streamDone(cb, cookie);

    expect(cb.groups).toHaveLength(3); // red, ALL, blue
    // ALL group should have all records
    const allGroup = cb.groups.find((g) => g.length === 2);
    expect(allGroup).toBeDefined();
  });

  test("is registered", () => {
    expect(clumperRegistry.has("cubekeyperfect")).toBe(true);
  });
});

describe("Key (adjacent) clumper", () => {
  test("groups adjacent records with same key", () => {
    const clumper = new KeyAdjacentClumper("color");
    const cb = new TestCallback();
    const cookie = makeKeyAdjacentInitialState();

    const records = [
      new Record({ color: "red", val: 1 }),
      new Record({ color: "red", val: 2 }),
      new Record({ color: "blue", val: 3 }),
      new Record({ color: "blue", val: 4 }),
      new Record({ color: "red", val: 5 }),
    ];

    for (const rec of records) {
      clumper.acceptRecord(rec, cb, cookie);
    }
    clumper.streamDone(cb, cookie);

    expect(cb.groups).toHaveLength(3); // red, blue, red
    expect(cb.groups[0]).toHaveLength(2);
    expect(cb.groups[1]).toHaveLength(2);
    expect(cb.groups[2]).toHaveLength(1);
  });

  test("is registered", () => {
    expect(clumperRegistry.has("key")).toBe(true);
  });
});

describe("Window clumper", () => {
  test("creates rolling windows", () => {
    const clumper = new WindowClumper("3");
    const cb = new TestCallback();
    const cookie = makeWindowInitialState();

    const records = [
      new Record({ val: 1 }),
      new Record({ val: 2 }),
      new Record({ val: 3 }),
      new Record({ val: 4 }),
      new Record({ val: 5 }),
    ];

    for (const rec of records) {
      clumper.acceptRecord(rec, cb, cookie);
    }
    clumper.streamDone(cb, cookie);

    // Windows: [1,2,3], [2,3,4], [3,4,5]
    expect(cb.groups).toHaveLength(3);
    expect(cb.groups[0]).toHaveLength(3);
    expect(cb.groups[1]).toHaveLength(3);
    expect(cb.groups[2]).toHaveLength(3);
  });

  test("no windows emitted if fewer records than window size", () => {
    const clumper = new WindowClumper("5");
    const cb = new TestCallback();
    const cookie = makeWindowInitialState();

    const records = [
      new Record({ val: 1 }),
      new Record({ val: 2 }),
    ];

    for (const rec of records) {
      clumper.acceptRecord(rec, cb, cookie);
    }
    clumper.streamDone(cb, cookie);

    expect(cb.groups).toHaveLength(0);
  });

  test("is registered", () => {
    expect(clumperRegistry.has("window")).toBe(true);
  });
});

describe("KeyLRU clumper", () => {
  test("limits active groups", () => {
    const clumper = new KeyLRUClumper("color", "2");
    const cb = new TestCallback();
    const cookie = makeKeyLRUInitialState();

    const records = [
      new Record({ color: "red", val: 1 }),
      new Record({ color: "blue", val: 2 }),
      new Record({ color: "green", val: 3 }), // evicts red
      new Record({ color: "blue", val: 4 }),
      new Record({ color: "red", val: 5 }), // evicts green
    ];

    for (const rec of records) {
      clumper.acceptRecord(rec, cb, cookie);
    }
    clumper.streamDone(cb, cookie);

    // Groups should be closed: red (evicted), green (evicted), then blue+red at streamDone
    expect(cb.groups.length).toBeGreaterThanOrEqual(3);
  });

  test("is registered", () => {
    expect(clumperRegistry.has("keylru")).toBe(true);
  });
});
