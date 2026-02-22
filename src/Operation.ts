import { Record } from "./Record.ts";
import {
  snippetHelp,
  keyspecsHelp,
  keygroupsHelp,
  keysHelp,
  domainLanguageHelp,
  clumpingHelp,
} from "./cli/help-topics.ts";

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

  acceptLine(line: string): boolean {
    console.log(line);
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

/**
 * Thrown to signal an early exit (e.g. --list-aggregators, --show-aggregator).
 * The handler should print the message and exit.
 */
export class HelpExit extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HelpExit";
  }
}

/** Help type definition for --help-* flags */
interface HelpType {
  use: boolean;
  skipInAll: boolean;
  code: () => string;
  optionName?: string;
  description: string;
}

export abstract class Operation implements RecordReceiver {
  next: RecordReceiver;
  #filenameKey: string | null = null;
  #currentFilename = "NONE";
  #wantsHelp = false;
  #exitValue = 0;
  #helpTypes: Map<string, HelpType>;

  constructor(next?: RecordReceiver) {
    this.next = next ?? new PrinterReceiver();
    this.#helpTypes = new Map([
      ["all", {
        use: false,
        skipInAll: true,
        code: () => this.#allHelp(),
        description: "Output all help for this script",
      }],
      ["snippet", {
        use: false,
        skipInAll: false,
        code: snippetHelp,
        description: "Help on code snippets",
      }],
      ["keygroups", {
        use: false,
        skipInAll: false,
        code: keygroupsHelp,
        description: "Help on keygroups, a way of specifying multiple keys",
      }],
      ["keyspecs", {
        use: false,
        skipInAll: false,
        code: keyspecsHelp,
        description: "Help on keyspecs, a way to index deeply and with regexes",
      }],
      ["basic", {
        use: true,
        skipInAll: false,
        optionName: "help",
        code: () => this.usage(),
        description: "This help screen",
      }],
      ["keys", {
        use: false,
        skipInAll: true,
        code: keysHelp,
        description: "Help on keygroups and keyspecs",
      }],
      ["domainlanguage", {
        use: false,
        skipInAll: false,
        code: domainLanguageHelp,
        description: "Help on the recs domain language",
      }],
      ["clumping", {
        use: false,
        skipInAll: false,
        code: clumpingHelp,
        description: "Help on clumping; mechanisms to group records across a stream",
      }],
    ]);
    this.addHelpTypes();
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
   * Hook for subclasses to enable help types.
   * Override and call useHelpType() / addHelpType() as needed.
   */
  addHelpTypes(): void {
    // default: no-op; subclasses override
  }

  /**
   * Enable a built-in help type (e.g. "snippet", "keyspecs").
   */
  useHelpType(type: string): void {
    const entry = this.#helpTypes.get(type);
    if (entry) {
      entry.use = true;
    }
    // Enabling any help type also enables --help-all
    const allEntry = this.#helpTypes.get("all");
    if (allEntry) {
      allEntry.use = true;
    }
  }

  /**
   * Add a custom help type.
   */
  addCustomHelpType(
    type: string,
    code: () => string,
    description: string,
    skipInAll = false,
    optionName?: string,
  ): void {
    this.#helpTypes.set(type, {
      use: true,
      skipInAll,
      code,
      description,
      optionName,
    });
    // Also ensure --help-all is available
    const allEntry = this.#helpTypes.get("all");
    if (allEntry) {
      allEntry.use = true;
    }
  }

  /**
   * Generate --help-all output: all enabled help types combined.
   */
  #allHelp(): string {
    const parts: string[] = [];
    for (const [type, info] of this.#helpTypes) {
      if (!info.use || info.skipInAll) continue;
      parts.push(`Help from: --help-${type}:\n`);
      parts.push(info.code());
      parts.push("");
    }
    return parts.join("\n");
  }

  /**
   * Parse command-line options. Provides a simple argument parser.
   * Returns remaining unparsed arguments.
   *
   * Supports:
   * - --flag / -f for boolean options
   * - --no-flag negation for boolean options
   * - --flag value / --flag=value for string/number options
   * - --filename-key / -fk auto-registered for record-outputting operations
   * - --help-* flags for enabled help types
   */
  parseOptions(
    args: string[],
    optionDefs: OptionDef[]
  ): string[] {
    // Build combined defs: user defs + auto-registered defs
    const allDefs = [...optionDefs];

    // Auto-register --filename-key / -fk if this operation outputs records
    if (this.doesRecordOutput()) {
      allDefs.push({
        long: "filename-key",
        short: "fk",
        type: "string",
        handler: (v) => { this.setFilenameKey(v as string); },
        description: "Add a key with the source filename (if no filename is applicable, uses NONE)",
      });
    }

    // Build help option handlers
    const helpHandlers = new Map<string, () => void>();
    for (const [type, info] of this.#helpTypes) {
      if (!info.use) continue;
      const optName = info.optionName ?? `help-${type}`;
      helpHandlers.set(`--${optName}`, () => {
        throw new HelpExit(info.code());
      });
    }

    const remaining: string[] = [];
    let i = 0;

    while (i < args.length) {
      const arg = args[i]!;
      let matched = false;

      // Check help flags first
      if (arg === "--help" || arg === "-h") {
        this.#wantsHelp = true;
        i++;
        continue;
      }

      const helpHandler = helpHandlers.get(arg);
      if (helpHandler) {
        helpHandler();
        i++;
        continue;
      }

      for (const def of allDefs) {
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

        // Handle --no-flag negation for boolean options
        if (def.type === "boolean" && arg === `--no-${def.long}`) {
          def.handler(false);
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
        if (arg.startsWith("-") && arg !== "-" && arg !== "--") {
          throw new Error(`Unknown option: ${arg}`);
        }
        // "--" ends option parsing: push all remaining args as positional
        if (arg === "--") {
          i++;
          while (i < args.length) {
            remaining.push(args[i]!);
            i++;
          }
          break;
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
