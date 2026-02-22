import { spawnSync } from "node:child_process";
import { Operation } from "../../Operation.ts";
import type { RecordReceiver, OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";

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
  return operationFactories.has(name) || name.startsWith("recs-");
}

export function createOperation(
  name: string,
  args: string[],
  next: RecordReceiver
): Operation {
  // Strip recs- prefix if present
  const baseName = name.replace(/^recs-/, "");
  const factory = operationFactories.get(baseName) ?? operationFactories.get(name);
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
  const baseName = name.replace(/^recs-/, "");
  return operationFactories.has(baseName) || operationFactories.has(name);
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
    const defs: OptionDef[] = [
      {
        long: "show-chain",
        type: "boolean",
        handler: () => { this.showChain = true; },
        description: "Print out what will happen in the chain before running",
      },
      {
        long: "dry-run",
        short: "n",
        type: "boolean",
        handler: () => { this.showChain = true; this.dryRun = true; },
        description: "Do not run commands, implies --show-chain",
      },
    ];

    // Find first non-option arg and treat everything after as the chain
    const remaining = this.parseOptions(args, defs);
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
    return false;
  }

  acceptRecord(record: Record): boolean {
    if (this.operations.length > 0) {
      return this.operations[0]!.acceptRecord(record);
    }
    return this.pushRecord(record);
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
        "recs chain recs-frommultire 'data,time=(\\S+) (\\S+)' \\| recs-sort --key time=n \\| recs-collate --a perc,90,data",
    },
    {
      description: "Use shell commands in your recs stream",
      command:
        "recs chain recs-frommultire 'data,time=(\\S+) (\\S+)' \\| recs-sort --key time=n \\| grep foo \\| recs-collate --a perc,90,data",
    },
  ],
  seeAlso: ["collate", "sort", "xform"],
};
