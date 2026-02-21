import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Executor, autoReturn } from "../../Executor.ts";
import { Record } from "../../Record.ts";

/**
 * Evaluate a JS snippet on each record and output the result as a line.
 * This is NOT a record stream output—it prints raw text lines.
 *
 * Analogous to App::RecordStream::Operation::eval in Perl.
 */
export class EvalOperation extends Operation {
  executor!: Executor;
  chomp = false;

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "chomp",
        type: "boolean",
        handler: () => { this.chomp = true; },
        description: "Chomp eval results (remove trailing newlines)",
      },
    ];

    const remaining = this.parseOptions(args, defs);
    const expression = remaining.join(" ");
    if (!expression) {
      throw new Error("eval requires an expression argument");
    }

    this.executor = new Executor(autoReturn(expression));
  }

  acceptRecord(record: Record): boolean {
    let value = this.executor.executeCode(record);
    let result = String(value ?? "");

    if (this.chomp) {
      result = result.replace(/\n+$/, "");
    }

    this.pushLine(result);
    return true;
  }

  override doesRecordOutput(): boolean {
    return false;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "eval",
  category: "transform",
  synopsis: "recs eval [options] <expression> [files...]",
  description:
    "Evaluate an expression on each record and print the result as a line " +
    "of text. This is NOT a record stream output -- it prints raw text lines. " +
    "The expression is evaluated with r set to the current Record object and " +
    "line set to the current line number (starting at 1).",
  options: [
    {
      flags: ["--chomp"],
      description:
        "Chomp eval results (remove trailing newlines to avoid duplicate " +
        "newlines when already newline-terminated).",
    },
  ],
  examples: [
    {
      description: "Print the host field from each record",
      command: "recs eval 'r.host'",
    },
    {
      description: "Prepare to gnuplot field y against field x",
      command: "recs eval 'r.x + \" \" + r.y'",
    },
  ],
  seeAlso: ["xform", "grep"],
};
