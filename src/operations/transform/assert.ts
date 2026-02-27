import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Executor, autoReturn, snippetFromFileOption, executorCommandDocOptions } from "../../Executor.ts";
import { Record } from "../../Record.ts";
import type { SnippetRunner } from "../../snippets/SnippetRunner.ts";
import { createSnippetRunner, isJsLang, langOptionDef } from "../../snippets/index.ts";

/**
 * Assert conditions on records, failing the pipeline if violated.
 *
 * Analogous to App::RecordStream::Operation::assert in Perl.
 */
export class AssertOperation extends Operation {
  extraArgs: string[] = [];
  executor!: Executor;
  assertion = "";
  diagnostic = "";
  verbose = false;
  lang: string | null = null;
  runner: SnippetRunner | null = null;
  bufferedRecords: Record[] = [];

  override addHelpTypes(): void {
    this.useHelpType("snippet");
    this.useHelpType("keyspecs");
  }

  init(args: string[]): void {
    let fileSnippet: string | null = null;
    let exprSnippet: string | null = null;

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
      {
        long: "expr",
        short: "e",
        type: "string",
        handler: (v) => { exprSnippet = v as string; },
        description: "Inline expression to evaluate (alternative to positional argument)",
      },
      snippetFromFileOption((code) => { fileSnippet = code; }),
      langOptionDef((v) => { this.lang = v; }),
    ];

    const remaining = this.parseOptions(args, defs);

    let expression: string;
    if (fileSnippet ?? exprSnippet) {
      expression = (fileSnippet ?? exprSnippet)!;
      this.extraArgs = remaining;
    } else {
      if (remaining.length === 0) {
        throw new Error("assert requires an expression argument");
      }
      expression = remaining[0]!;
      this.extraArgs = remaining.slice(1);
    }

    this.assertion = expression;

    if (this.lang && !isJsLang(this.lang)) {
      this.runner = createSnippetRunner(this.lang);
      void this.runner.init(expression, { mode: "grep" });
    } else {
      this.executor = new Executor(autoReturn(expression));
    }
  }

  acceptRecord(record: Record): boolean {
    if (this.runner) {
      this.bufferedRecords.push(record);
      return true;
    }

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

  override streamDone(): void {
    if (this.runner && this.bufferedRecords.length > 0) {
      const results = this.runner.executeBatch(this.bufferedRecords);
      for (let i = 0; i < results.length; i++) {
        const result = results[i]!;
        const record = this.bufferedRecords[i]!;

        if (result.error) {
          throw new Error(`Assertion failed! ${this.diagnostic}\n` +
            `Expression: « ${this.assertion} »\n` +
            `Error: ${result.error}\n`);
        }

        if (!result.passed) {
          let message = `Assertion failed! ${this.diagnostic}\n`;
          message += `Expression: « ${this.assertion} »\n`;
          message += `Line: ${i + 1}\n`;

          if (this.verbose) {
            message += `Record: ${JSON.stringify(record.toJSON(), null, 2)}\n`;
          }

          throw new Error(message);
        }

        this.pushRecord(record);
      }
    }
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
    ...executorCommandDocOptions(),
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
