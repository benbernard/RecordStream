import type { Clumper, ClumperCallback } from "../Clumper.ts";
import { clumperRegistry } from "../Clumper.ts";
import { KeyGroups } from "../KeyGroups.ts";
import { findKey } from "../KeySpec.ts";
import type { Record } from "../Record.ts";
import type { JsonObject, JsonValue } from "../types/json.ts";

/**
 * ClumperOptions handles CLI option parsing for clumper specifications.
 * Supports both old-style (--key) and new-style (--clumper) grouping.
 *
 * Analogous to App::RecordStream::Clumper::Options in Perl.
 */

interface PendingClumper {
  type: "keygroup" | "clumper";
  value: string | Clumper;
}

export class ClumperOptions {
  keySize: number | null = null;
  keyCube = false;
  keyPerfect = false;
  pending: PendingClumper[] = [];
  callback: ClumperCallback | null = null;
  callbackCookie: unknown = undefined;
  helpList = false;
  helpShow: string | null = null;
  groups: Map<string, unknown> | null = null;
  groupOrder: string[] = [];

  /**
   * Add a key group spec for grouping.
   */
  addKey(spec: string): void {
    this.pending.push({ type: "keygroup", value: spec });
  }

  /**
   * Add a clumper by spec string.
   */
  addClumper(spec: string): void {
    const clumper = clumperRegistry.parse(spec);
    this.pending.push({ type: "clumper", value: clumper });
  }

  /**
   * Set the LRU key size (for adjacent/windowed grouping).
   */
  setKeySize(size: number): void {
    this.keySize = size;
  }

  /**
   * Enable perfect mode (group records regardless of order).
   */
  setPerfect(enabled: boolean): void {
    this.keyPerfect = enabled;
  }

  /**
   * Enable cube mode.
   */
  setCube(enabled: boolean): void {
    this.keyCube = enabled;
  }

  setHelpList(val: boolean): void {
    this.helpList = val;
  }

  setHelpShow(name: string): void {
    this.helpShow = name;
  }

  /**
   * Initialize the clumper options with a callback for receiving groups.
   */
  checkOptions(callback: ClumperCallback): void {
    if (this.helpList) {
      throw new Error(clumperRegistry.listImplementations());
    }
    if (this.helpShow) {
      throw new Error(clumperRegistry.showImplementation(this.helpShow));
    }
    this.callback = callback;
    this.callbackCookie = undefined;
  }

  /**
   * Get the key groups to use for clumping, resolving them from the
   * pending specs.
   */
  getKeySpecs(record: Record): string[] {
    const specs: string[] = [];
    for (const p of this.pending) {
      if (p.type === "keygroup") {
        const kg = new KeyGroups(p.value as string);
        specs.push(...kg.getKeyspecs(record.dataRef() as JsonObject));
      }
    }
    return specs;
  }

  /**
   * Accept a record, resolving pending clumper configuration on first call.
   * Groups records by key specs if any are configured.
   */
  acceptRecord(record: Record): boolean {
    if (!this.callback) {
      throw new Error("checkOptions must be called before acceptRecord");
    }

    // No keys configured: all records go into one group
    if (this.pending.length === 0) {
      if (this.callbackCookie === undefined) {
        this.callbackCookie = this.callback.clumperCallbackBegin({});
      }
      this.callback.clumperCallbackPushRecord(this.callbackCookie, record);
      return true;
    }

    // Get key specs and values for this record
    const keySpecs = this.getKeySpecs(record);
    const data = record.dataRef() as JsonObject;
    const keyValues: { [key: string]: JsonValue } = {};
    const keyParts: string[] = [];

    for (const spec of keySpecs) {
      const val = findKey(data, spec, true);
      keyValues[spec] = val ?? null;
      keyParts.push(String(val ?? ""));
    }

    if (!this.groups) {
      this.groups = new Map();
    }

    // In cube mode, generate all 2^N combinations of actual values and "ALL"
    const combos = this.keyCube
      ? this.cubeKeyValues(keySpecs, keyValues)
      : [{ keyValues, keyParts }];

    for (const combo of combos) {
      const groupKey = combo.keyParts.join("\x1E");

      let cookie = this.groups.get(groupKey);
      if (cookie === undefined) {
        // Handle LRU eviction if keySize is set and NOT in perfect mode
        if (!this.keyPerfect && this.keySize !== null && this.groups.size >= this.keySize) {
          const oldestKey = this.groupOrder.shift()!;
          const oldCookie = this.groups.get(oldestKey);
          if (oldCookie !== undefined) {
            this.callback.clumperCallbackEnd(oldCookie);
            this.groups.delete(oldestKey);
          }
        }

        cookie = this.callback.clumperCallbackBegin(combo.keyValues);
        this.groups.set(groupKey, cookie);
        this.groupOrder.push(groupKey);
      }

      this.callback.clumperCallbackPushRecord(cookie, record);
    }

    return true;
  }

  /**
   * Signal that the stream is done.
   */
  streamDone(): void {
    if (!this.callback) return;

    if (this.pending.length === 0) {
      // No keys: single group
      if (this.callbackCookie !== undefined) {
        this.callback.clumperCallbackEnd(this.callbackCookie);
      }
    } else if (this.groups) {
      // End all remaining groups in order
      for (const key of this.groupOrder) {
        const cookie = this.groups.get(key);
        if (cookie !== undefined) {
          this.callback.clumperCallbackEnd(cookie);
        }
      }
      this.groups.clear();
      this.groupOrder = [];
    }
  }

  /**
   * Generate all 2^N combinations of actual key values and "ALL" for cube mode.
   */
  cubeKeyValues(
    keySpecs: string[],
    keyValues: { [key: string]: JsonValue }
  ): Array<{ keyValues: { [key: string]: JsonValue }; keyParts: string[] }> {
    const n = keySpecs.length;
    const combos: Array<{ keyValues: { [key: string]: JsonValue }; keyParts: string[] }> = [];

    // Iterate all 2^N bitmasks
    for (let mask = 0; mask < (1 << n); mask++) {
      const comboValues: { [key: string]: JsonValue } = {};
      const comboParts: string[] = [];

      for (let i = 0; i < n; i++) {
        const spec = keySpecs[i]!;
        if (mask & (1 << i)) {
          // Replace this key with "ALL"
          comboValues[spec] = "ALL";
          comboParts.push("ALL");
        } else {
          // Use actual value
          comboValues[spec] = keyValues[spec] ?? null;
          comboParts.push(String(keyValues[spec] ?? ""));
        }
      }

      combos.push({ keyValues: comboValues, keyParts: comboParts });
    }

    return combos;
  }

  getKeySize(): number | null {
    return this.keySize;
  }

  isAdjacent(): boolean {
    return this.keySize === 1;
  }

  isPerfect(): boolean {
    return this.keyPerfect;
  }

  isCube(): boolean {
    return this.keyCube;
  }
}
