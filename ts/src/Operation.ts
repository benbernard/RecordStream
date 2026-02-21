import { Record } from "./Record.ts";

/**
 * Base class for all RecordStream operations.
 *
 * An operation receives records, processes them, and optionally emits
 * records downstream. Operations are connected in a pipeline.
 *
 * Analogous to App::RecordStream::Operation in Perl.
 */

/**
 * Interface for the downstream consumer of records.
 */
export interface RecordReceiver {
  acceptRecord(record: Record): boolean;
  acceptLine?(line: string): boolean;
  finish(): void;
}

/**
 * A simple receiver that prints records as JSON lines to stdout.
 */
export class PrinterReceiver implements RecordReceiver {
  acceptRecord(record: Record): boolean {
    console.log(record.toString());
    return true;
  }

  finish(): void {
    // nothing to do
  }
}

/**
 * A receiver that collects records into an array.
 */
export class CollectorReceiver implements RecordReceiver {
  readonly records: Record[] = [];

  acceptRecord(record: Record): boolean {
    this.records.push(record);
    return true;
  }

  finish(): void {
    // nothing to do
  }
}

export abstract class Operation implements RecordReceiver {
  next: RecordReceiver;
  #filenameKey: string | null = null;
  #currentFilename = "NONE";
  #wantsHelp = false;
  #exitValue = 0;

  constructor(next?: RecordReceiver) {
    this.next = next ?? new PrinterReceiver();
  }

  /**
   * Initialize the operation with CLI arguments.
   * Subclasses should override to parse their specific args.
   */
  abstract init(args: string[]): void;

  /**
   * Process a single record. Subclasses must implement.
   * Return true to continue processing, false to stop.
   */
  abstract acceptRecord(record: Record): boolean;

  /**
   * Called when the input stream is exhausted.
   * Subclasses can override to emit final records.
   */
  streamDone(): void {
    // default: no-op
  }

  /**
   * Called when all processing is complete (including chained streams).
   */
  finish(): void {
    this.streamDone();
    this.next.finish();
  }

  /**
   * Accept a JSON line, parse it into a record, and process it.
   */
  acceptLine(line: string): boolean {
    const record = Record.fromJSON(line);
    return this.acceptRecord(record);
  }

  /**
   * Emit a record downstream.
   */
  pushRecord(record: Record): boolean {
    if (this.#filenameKey) {
      record.set(this.#filenameKey, this.#currentFilename);
    }
    return this.next.acceptRecord(record);
  }

  /**
   * Emit a raw line downstream.
   */
  pushLine(line: string): void {
    if (this.next.acceptLine) {
      this.next.acceptLine(line);
    }
  }

  /**
   * Whether this operation consumes input records.
   */
  wantsInput(): boolean {
    return true;
  }

  /**
   * Whether this operation produces record output.
   */
  doesRecordOutput(): boolean {
    return true;
  }

  /**
   * Set the filename key for annotating records with source filename.
   */
  setFilenameKey(key: string): void {
    this.#filenameKey = key;
  }

  /**
   * Update the current input filename.
   */
  updateCurrentFilename(filename: string): void {
    this.#currentFilename = filename;
  }

  getCurrentFilename(): string {
    return this.#currentFilename;
  }

  /**
   * Return the usage string for this operation.
   * Subclasses should override.
   */
  usage(): string {
    return "No usage information available.";
  }

  setWantsHelp(val: boolean): void {
    this.#wantsHelp = val;
  }

  getWantsHelp(): boolean {
    return this.#wantsHelp;
  }

  setExitValue(val: number): void {
    this.#exitValue = val;
  }

  getExitValue(): number {
    return this.#exitValue;
  }

  /**
   * Parse command-line options. Provides a simple argument parser.
   * Returns remaining unparsed arguments.
   */
  parseOptions(
    args: string[],
    optionDefs: OptionDef[]
  ): string[] {
    const remaining: string[] = [];
    let i = 0;

    while (i < args.length) {
      const arg = args[i]!;
      let matched = false;

      if (arg === "--help" || arg === "-h") {
        this.#wantsHelp = true;
        i++;
        continue;
      }

      for (const def of optionDefs) {
        const longFlag = `--${def.long}`;
        const shortFlag = def.short ? `-${def.short}` : null;

        if (arg === longFlag || (shortFlag && arg === shortFlag)) {
          if (def.type === "boolean") {
            def.handler(true);
          } else {
            // Needs a value argument
            i++;
            const value = args[i];
            if (value === undefined) {
              throw new Error(`Option ${arg} requires a value`);
            }
            def.handler(value);
          }
          matched = true;
          break;
        }

        // Handle --flag=value syntax
        if (def.type !== "boolean" && arg.startsWith(longFlag + "=")) {
          const value = arg.slice(longFlag.length + 1);
          def.handler(value);
          matched = true;
          break;
        }
      }

      if (!matched) {
        if (arg.startsWith("-") && arg !== "-") {
          throw new Error(`Unknown option: ${arg}`);
        }
        remaining.push(arg);
      }

      i++;
    }

    return remaining;
  }
}

export interface OptionDef {
  long: string;
  short?: string;
  type: "string" | "boolean" | "number";
  handler: (value: string | boolean | number) => void;
  description: string;
}
