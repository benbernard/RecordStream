import { Operation } from "../../Operation.ts";
import type { RecordReceiver } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { resolveAlias } from "../../aliases.ts";

/**
 * Registry of operation factories, for creating operations by name.
 * Operations register themselves here so chain can instantiate them.
 */
const operationFactories = new Map<
  string,
  (next: RecordReceiver) => Operation
>();

export function registerOperationFactory(
  name: string,
  factory: (next: RecordReceiver) => Operation
): void {
  operationFactories.set(name, factory);
}

export function isRecsOperation(name: string): boolean {
  return operationFactories.has(name);
}

export function createOperation(
  name: string,
  args: string[],
  next: RecordReceiver
): Operation {
  const factory = operationFactories.get(name);
  if (!factory) {
    throw new Error(`Unknown recs operation: ${name}`);
  }
  const op = factory(next);
  op.init(args);
  return op;
}

/**
 * Create a recs operation if the name is registered, otherwise fall back
 * to a ShellOperation that pipes JSONL through the external command.
 */
export function createOperationOrShell(
  name: string,
  args: string[],
  next: RecordReceiver,
): Operation {
  if (operationFactories.has(name)) {
    return createOperation(name, args, next);
  }
  return new ShellOperation(next, name, args);
}

/**
 * Receiver wrapper that forwards records/lines but blocks finish propagation.
 * ChainOperation uses this between operations so it can manage the finish
 * sequence explicitly (required for async shell operations).
 */
class ChainFinishBarrier implements RecordReceiver {
  constructor(private target: RecordReceiver) {}

  acceptRecord(record: Record): boolean {
    return this.target.acceptRecord(record);
  }

  acceptLine(line: string): boolean {
    if (this.target.acceptLine) {
      return this.target.acceptLine(line);
    }
    return true;
  }

  finish(): void {
    // Intentionally does NOT propagate.
    // ChainOperation manages the finish sequence.
  }
}

/**
 * A "shell operation" that pipes JSONL through an external command using
 * streaming I/O. Records are written to the command's stdin as they arrive,
 * and stdout is read asynchronously and parsed back to records.
 *
 * This replaces the previous spawnSync-based approach which buffered the
 * entire dataset in memory (with a 100MB limit). The streaming approach
 * can handle arbitrarily large datasets.
 */
class ShellOperation extends Operation {
  command: string;
  commandArgs: string[];
  spawnedProc: {
    readonly stdin: { write(data: string): number | Promise<number>; end(): number | Promise<number> };
    readonly stdout: ReadableStream<Uint8Array>;
    readonly stderr: ReadableStream<Uint8Array>;
    readonly exited: Promise<number>;
  } | null = null;
  outputDone: Promise<void> | null = null;
  stderrDone: Promise<void> | null = null;
  stdinClosed = false;

  constructor(next: RecordReceiver, command: string, commandArgs: string[]) {
    super(next);
    this.command = command;
    this.commandArgs = commandArgs;
  }

  init(_args: string[]): void {
    // No-op: initialized via constructor
  }

  ensureProcess(): void {
    if (this.spawnedProc) return;
    try {
      this.spawnedProc = Bun.spawn([this.command, ...this.commandArgs], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Shell command '${this.command}' failed: ${msg}`);
    }
    // Start reading stdout/stderr immediately to avoid pipe buffer deadlocks
    this.outputDone = this.readStdout();
    this.stderrDone = this.readStderr();
  }

  async readStdout(): Promise<void> {
    const reader = this.spawnedProc!.stdout.getReader();
    const decoder = new TextDecoder();
    let partial = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        partial += decoder.decode(value, { stream: true });

        const lines = partial.split("\n");
        partial = lines.pop()!;

        for (const line of lines) {
          if (line.trim() === "") continue;
          try {
            this.pushRecord(Record.fromJSON(line));
          } catch {
            this.pushLine(line);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Flush remaining decoder state
    partial += decoder.decode();
    if (partial.trim()) {
      try {
        this.pushRecord(Record.fromJSON(partial));
      } catch {
        this.pushLine(partial);
      }
    }
  }

  async readStderr(): Promise<void> {
    const reader = this.spawnedProc!.stderr.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        process.stderr.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
  }

  acceptRecord(record: Record): boolean {
    if (this.stdinClosed) return false;
    this.ensureProcess();
    try {
      this.spawnedProc!.stdin.write(record.toString() + "\n");
    } catch {
      // Process may have exited early (e.g. head -1), stop writing
      this.stdinClosed = true;
      return false;
    }
    return true;
  }

  override streamDone(): void {
    // No-op: finish() handles cleanup
  }

  override finish(): void {
    if (!this.spawnedProc) {
      // No records were sent; no process to wait on
      this.next.finish();
      return;
    }

    const doFinish = async (): Promise<void> => {
      // Close stdin to signal end of input
      if (!this.stdinClosed) {
        try {
          await this.spawnedProc!.stdin.end();
        } catch {
          // stdin may already be closed if the process exited early
        }
      }

      // Wait for stdout and stderr readers to complete
      await Promise.all([this.outputDone, this.stderrDone]);

      // Wait for process to exit
      await this.spawnedProc!.exited;

      this.next.finish();
    };

    return doFinish() as unknown as void;
  }
}

/**
 * Check whether a command name refers to a known recs operation.
 */
function isKnownRecsOp(name: string): boolean {
  return operationFactories.has(name);
}

/**
 * Chain multiple recs operations in sequence, passing records
 * in-memory between them. Non-recs commands are spawned as shell
 * subprocesses with JSONL piped through them.
 *
 * Analogous to App::RecordStream::Operation::chain in Perl.
 */
export class ChainOperation extends Operation {
  operations: Operation[] = [];
  showChain = false;
  dryRun = false;

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
  }

  init(args: string[]): void {
    // Parse only chain-specific flags (--show-chain, --dry-run / -n) from the
    // leading args. Stop as soon as we hit the first positional arg (the first
    // sub-command name) so that sub-command flags like --header aren't rejected
    // as unknown chain options.
    const remaining: string[] = [];
    let i = 0;
    while (i < args.length) {
      const arg = args[i]!;
      if (arg === "--show-chain") {
        this.showChain = true;
      } else if (arg === "--dry-run" || arg === "-n") {
        this.showChain = true;
        this.dryRun = true;
      } else {
        // First non-chain-option arg: the rest is the sub-command pipeline
        remaining.push(...args.slice(i));
        break;
      }
      i++;
    }
    if (remaining.length === 0) return;

    // Split by | into individual command groups
    const commands: string[][] = [];
    let current: string[] = [];
    for (const arg of remaining) {
      if (arg === "|") {
        if (current.length > 0) {
          commands.push(current);
          current = [];
        }
      } else {
        current.push(arg);
      }
    }
    if (current.length > 0) {
      commands.push(current);
    }

    // Resolve aliases in each command group
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]!;
      const name = cmd[0]!;
      const cmdArgs = cmd.slice(1);
      const aliasResult = resolveAlias(name, cmdArgs);
      if (aliasResult) {
        commands[i] = [aliasResult.command, ...aliasResult.args];
      }
    }

    if (this.showChain) {
      for (let idx = 0; idx < commands.length; idx++) {
        const cmd = commands[idx]!;
        const name = cmd[0]!;
        const type = isKnownRecsOp(name) ? "recs" : "shell";
        process.stderr.write(`Chain step ${idx + 1}: [${type}] ${cmd.join(" ")}\n`);
      }
    }

    if (this.dryRun) return;

    // Build the operation chain from right to left.
    // Each operation's receiver is wrapped in a ChainFinishBarrier so that
    // finish() calls don't cascade automatically. ChainOperation manages the
    // finish sequence explicitly (required for async shell operations).
    let receiver: RecordReceiver = this.next;
    const ops: Operation[] = [];

    for (let i = commands.length - 1; i >= 0; i--) {
      const cmd = commands[i]!;
      const name = cmd[0]!;
      const cmdArgs = cmd.slice(1);

      const barrier = new ChainFinishBarrier(receiver);

      let op: Operation;
      if (isKnownRecsOp(name)) {
        op = createOperation(name, cmdArgs, barrier);
      } else {
        // Shell command: pipe JSONL through it
        op = new ShellOperation(barrier, name, cmdArgs);
      }
      ops.unshift(op);
      receiver = op;
    }

    this.operations = ops;
  }

  override wantsInput(): boolean {
    if (this.operations.length === 0) return false;
    const first = this.operations[0]!;
    // Transform ops (grep, sort) consume records from stdin
    if (first.wantsInput()) return true;
    // Line-oriented input ops (fromre, frommultire) consume raw lines
    if (this.firstOpHasCustomAcceptLine()) return true;
    // Bulk-content input ops (fromcsv, fromkv) need all stdin fed via parseContent
    if (this.firstOpNeedsBulkStdin()) return true;
    return false;
  }

  /**
   * Whether the first operation overrides acceptLine (line-oriented input op).
   */
  firstOpHasCustomAcceptLine(): boolean {
    const first = this.operations[0];
    if (!first) return false;
    const proto = Object.getPrototypeOf(first) as { [key: string]: unknown };
    return typeof proto["acceptLine"] === "function" &&
      proto["acceptLine"] !== Operation.prototype.acceptLine;
  }

  /**
   * Whether the first operation has a parseContent method and no file args
   * (bulk-content input ops like fromcsv, fromjsonarray that need stdin).
   */
  firstOpNeedsBulkStdin(): boolean {
    const first = this.operations[0];
    if (!first) return false;
    const opAny = first as unknown as { [key: string]: unknown };
    if (typeof opAny["parseContent"] !== "function" && typeof opAny["parseXml"] !== "function") return false;
    const extraArgs = opAny["extraArgs"];
    if (Array.isArray(extraArgs) && extraArgs.length > 0) return false;
    return true;
  }

  /** Buffer for bulk stdin content when first op needs parseContent */
  bulkStdinLines: string[] = [];

  acceptRecord(record: Record): boolean {
    if (this.operations.length > 0) {
      return this.operations[0]!.acceptRecord(record);
    }
    return this.pushRecord(record);
  }

  override acceptLine(line: string): boolean {
    if (this.operations.length === 0) return true;
    const first = this.operations[0]!;

    if (this.firstOpHasCustomAcceptLine()) {
      // Line-oriented input op (fromre, frommultire): forward raw lines
      return first.acceptLine!(line);
    }
    if (this.firstOpNeedsBulkStdin()) {
      // Bulk-content input op (fromcsv): buffer lines for parseContent
      this.bulkStdinLines.push(line);
      return true;
    }
    // Transform op: parse as JSON record
    try {
      const record = Record.fromJSON(line);
      return first.acceptRecord(record);
    } catch {
      return true;
    }
  }

  /**
   * Feed records into the chain.
   */
  feedRecords(records: Record[]): void {
    const head = this.operations[0];
    if (!head) return;

    for (const record of records) {
      if (!head.acceptRecord(record)) break;
    }
  }

  override streamDone(): void {
    // No-op: finish() handles the complete sequence
  }

  override finish(): void {
    if (this.dryRun) return;
    if (this.operations.length === 0) return;

    // If we buffered bulk stdin content, feed it to the first op now
    if (this.bulkStdinLines.length > 0) {
      const content = this.bulkStdinLines.join("\n") + "\n";
      const first = this.operations[0]!;
      const opAny = first as unknown as { [key: string]: unknown };
      if (typeof opAny["parseXml"] === "function") {
        (opAny["parseXml"] as (xml: string) => void)(content);
      } else if (typeof opAny["parseContent"] === "function") {
        (opAny["parseContent"] as (content: string) => void)(content);
      }
    }

    // Check if any shell ops need async finish
    const hasAsyncOps = this.operations.some(op => op instanceof ShellOperation);

    if (!hasAsyncOps) {
      // Pure recs chain: finish each op synchronously.
      // FinishBarriers prevent the cascade from propagating automatically.
      for (const op of this.operations) {
        op.finish();
      }
      this.next.finish();
      return;
    }

    // Chain with shell ops: finish each op with await for async support.
    const doFinish = async (): Promise<void> => {
      for (const op of this.operations) {
        await op.finish();
      }
      this.next.finish();
    };

    return doFinish() as unknown as void;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "chain",
  category: "transform",
  synopsis: "recs chain <command> | <command> | ...",
  description:
    "Creates an in-memory chain of recs operations. This avoids serialization " +
    "and deserialization of records at each step in a complex recs pipeline. " +
    "Arguments are specified on the command line separated by pipes. For most " +
    "shells, you will need to escape the pipe character to avoid having the " +
    "shell interpret it as a shell pipe.",
  options: [
    {
      flags: ["--show-chain"],
      description: "Before running the commands, print out what will happen in the chain.",
    },
    {
      flags: ["--dry-run", "-n"],
      description: "Do not run commands. Implies --show-chain.",
    },
  ],
  examples: [
    {
      description: "Parse some fields, sort and collate, all in memory",
      command:
        "recs chain frommultire 'data,time=(\\S+) (\\S+)' \\| sort --key time=n \\| collate --a perc,90,data",
    },
    {
      description: "Use shell commands in your recs stream",
      command:
        "recs chain frommultire 'data,time=(\\S+) (\\S+)' \\| sort --key time=n \\| grep foo \\| collate --a perc,90,data",
    },
  ],
  seeAlso: ["collate", "sort", "xform"],
};
