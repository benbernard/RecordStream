import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Executor, autoReturn, snippetFromFileOption } from "../../Executor.ts";
import { Record } from "../../Record.ts";

/**
 * Assert conditions on records, failing the pipeline if violated.
 *
 * Analogous to App::RecordStream::Operation::assert in Perl.
 */
export class AssertOperation extends Operation {
  executor!: Executor;
  assertion = "";
  diagnostic = "";
  verbose = false;

  override addHelpTypes(): void {
    this.useHelpType("snippet");
    this.useHelpType("keyspecs");
  }

  init(args: string[]): void {
    let fileSnippet: string | null = null;

    const defs: OptionDef[] = [
      {
        long: "diagnostic",
        short: "d",
        type: "string",
        handler: (v) => { this.diagnostic = v as string; },
        description: "Include this diagnostic string in failed assertion errors",
      },
      {
        long: "verbose",
        short: "v",
        type: "boolean",
        handler: () => { this.verbose = true; },
        description: "Verbose output for failed assertions; dumps the current record",
      },
      snippetFromFileOption((code) => { fileSnippet = code; }),
    ];

    const remaining = this.parseOptions(args, defs);
    const expression = fileSnippet ?? remaining.join(" ");
    if (!expression) {
      throw new Error("assert requires an expression argument");
    }

    this.assertion = expression;
    this.executor = new Executor(autoReturn(expression));
  }

  acceptRecord(record: Record): boolean {
    if (!this.executor.executeCode(record)) {
      let message = `Assertion failed! ${this.diagnostic}\n`;
      message += `Expression: « ${this.assertion} »\n`;
      message += `Filename: ${this.getCurrentFilename()}\n`;
      message += `Line: ${this.executor.getLine()}\n`;

      if (this.verbose) {
        message += `Record: ${JSON.stringify(record.toJSON(), null, 2)}\n`;
      }

      throw new Error(message);
    }

    this.pushRecord(record);
    return true;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "assert",
  category: "transform",
  synopsis: "recs assert [options] <expression> [files...]",
  description:
    "Asserts that every record in the stream must pass the given expression. " +
    "The expression is evaluated on each record with r set to the current " +
    "Record object and line set to the current line number (starting at 1). " +
    "If the expression does not evaluate to true, processing is immediately " +
    "aborted and an error message is printed.",
  options: [
    {
      flags: ["--diagnostic", "-d"],
      description: "Include this diagnostic string in any failed assertion errors.",
      argument: "<text>",
    },
    {
      flags: ["--verbose", "-v"],
      description: "Verbose output for failed assertions; dumps the current record.",
    },
  ],
  examples: [
    {
      description: "Require each record to have a date field",
      command: "recs assert 'r.date'",
    },
    {
      description: "Assert all values are positive with a diagnostic",
      command: "recs assert -d 'values must be positive' 'r.value > 0'",
    },
  ],
  seeAlso: ["grep", "xform"],
};
