import { spawnSync } from "node:child_process";
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
 * A "shell operation" that pipes JSONL through an external command.
 * Records are serialized to JSON, piped through the command's stdin/stdout,
 * and parsed back to records. Used when chain encounters a non-recs command.
 */
class ShellOperation extends Operation {
  command: string;
  commandArgs: string[];
  bufferedRecords: Record[] = [];

  constructor(next: RecordReceiver, command: string, commandArgs: string[]) {
    super(next);
    this.command = command;
    this.commandArgs = commandArgs;
  }

  init(_args: string[]): void {
    // No-op: initialized via constructor
  }

  acceptRecord(record: Record): boolean {
    this.bufferedRecords.push(record);
    return true;
  }

  override streamDone(): void {
    // Serialize all buffered records to JSONL
    const input = this.bufferedRecords.map((r) => r.toString()).join("\n") + "\n";

    // Spawn the shell command
    const result = spawnSync(this.command, this.commandArgs, {
      input,
      encoding: "utf-8",
      shell: false,
      maxBuffer: 100 * 1024 * 1024, // 100MB
    });

    if (result.error) {
      throw new Error(`Shell command '${this.command}' failed: ${result.error.message}`);
    }

    if (result.stderr && result.stderr.trim()) {
      process.stderr.write(result.stderr);
    }

    // Parse output lines back as records
    const output = result.stdout ?? "";
    const lines = output.split("\n").filter((line: string) => line.trim() !== "");
    for (const line of lines) {
      try {
        const record = Record.fromJSON(line);
        this.pushRecord(record);
      } catch {
        // If the line isn't valid JSON, pass it through as a raw line
        this.pushLine(line);
      }
    }
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

    // Build the operation chain from right to left
    let receiver: RecordReceiver = this.next;
    const ops: Operation[] = [];

    for (let i = commands.length - 1; i >= 0; i--) {
      const cmd = commands[i]!;
      const name = cmd[0]!;
      const cmdArgs = cmd.slice(1);

      let op: Operation;
      if (isKnownRecsOp(name)) {
        op = createOperation(name, cmdArgs, receiver);
      } else {
        // Shell command: pipe JSONL through it
        op = new ShellOperation(receiver, name, cmdArgs);
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
  private firstOpHasCustomAcceptLine(): boolean {
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
  private firstOpNeedsBulkStdin(): boolean {
    const first = this.operations[0];
    if (!first) return false;
    const opAny = first as unknown as { [key: string]: unknown };
    if (typeof opAny["parseContent"] !== "function" && typeof opAny["parseXml"] !== "function") return false;
    const extraArgs = opAny["extraArgs"];
    if (Array.isArray(extraArgs) && extraArgs.length > 0) return false;
    return true;
  }

  /** Buffer for bulk stdin content when first op needs parseContent */
  private bulkStdinLines: string[] = [];

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
    if (this.dryRun) return;

    if (this.operations.length > 0) {
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
      this.operations[0]!.finish();
    }
  }

  override finish(): void {
    this.streamDone();
    // The chain's last operation already connects to this.next,
    // so finishing the first operation propagates through the chain.
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
