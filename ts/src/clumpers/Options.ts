import type { Clumper, ClumperCallback } from "../Clumper.ts";
import { clumperRegistry } from "../Clumper.ts";
import { KeyGroups } from "../KeyGroups.ts";
import type { Record } from "../Record.ts";
import type { JsonObject } from "../types/json.ts";

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
  private keySize: number | null = null;
  private keyCube = false;
  private pending: PendingClumper[] = [];
  private callback: ClumperCallback | null = null;
  private callbackCookie: unknown = undefined;
  private helpList = false;
  private helpShow: string | null = null;

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
   */
  acceptRecord(record: Record): boolean {
    if (!this.callback) {
      throw new Error("checkOptions must be called before acceptRecord");
    }

    if (this.callbackCookie === undefined) {
      this.callbackCookie = this.callback.clumperCallbackBegin({});
    }

    this.callback.clumperCallbackPushRecord(this.callbackCookie, record);
    return true;
  }

  /**
   * Signal that the stream is done.
   */
  streamDone(): void {
    if (this.callback && this.callbackCookie !== undefined) {
      this.callback.clumperCallbackEnd(this.callbackCookie);
    }
  }

  getKeySize(): number | null {
    return this.keySize;
  }

  isAdjacent(): boolean {
    return this.keySize === 1;
  }

  isCube(): boolean {
    return this.keyCube;
  }
}
