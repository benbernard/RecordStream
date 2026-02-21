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
  const factory = operationFactories.get(name);
  if (!factory) {
    throw new Error(`Unknown recs operation: ${name}`);
  }
  const op = factory(next);
  op.init(args);
  return op;
}

/**
 * Chain multiple recs operations in sequence, passing records
 * in-memory between them.
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

    if (this.dryRun) return;

    // Build the operation chain from right to left
    let receiver: RecordReceiver = this.next;
    const ops: Operation[] = [];

    for (let i = commands.length - 1; i >= 0; i--) {
      const cmd = commands[i]!;
      const name = cmd[0]!;
      const cmdArgs = cmd.slice(1);

      const op = createOperation(name, cmdArgs, receiver);
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
    if (this.showChain) {
      // Print chain info
    }

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
