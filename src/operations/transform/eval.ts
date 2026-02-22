import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Executor, autoReturn, snippetFromFileOption } from "../../Executor.ts";
import { Record } from "../../Record.ts";
import type { SnippetRunner } from "../../snippets/SnippetRunner.ts";
import { createSnippetRunner, isJsLang, langOptionDef } from "../../snippets/index.ts";

/**
 * Evaluate a JS snippet on each record and output the result as a line.
 * This is NOT a record stream output—it prints raw text lines.
 *
 * When --lang is set to a non-JS language, the external runner modifies the
 * record and the modified record is output as a JSON line.
 *
 * Analogous to App::RecordStream::Operation::eval in Perl.
 */
export class EvalOperation extends Operation {
  executor!: Executor;
  chomp = false;
  lang: string | null = null;
  runner: SnippetRunner | null = null;
  #bufferedRecords: Record[] = [];

  override addHelpTypes(): void {
    this.useHelpType("snippet");
    this.useHelpType("keyspecs");
  }

  init(args: string[]): void {
    let fileSnippet: string | null = null;
    let exprSnippet: string | null = null;

    const defs: OptionDef[] = [
      {
        long: "chomp",
        type: "boolean",
        handler: () => { this.chomp = true; },
        description: "Chomp eval results (remove trailing newlines)",
      },
      {
        long: "expr",
        short: "e",
        type: "string",
        handler: (v) => { exprSnippet = v as string; },
        description: "Inline code snippet (alternative to positional argument)",
      },
      snippetFromFileOption((code) => { fileSnippet = code; }),
      langOptionDef((v) => { this.lang = v; }),
    ];

    const remaining = this.parseOptions(args, defs);
    const expression = fileSnippet ?? exprSnippet ?? remaining.join(" ");
    if (!expression) {
      throw new Error("eval requires an expression argument");
    }

    if (this.lang && !isJsLang(this.lang)) {
      this.runner = createSnippetRunner(this.lang);
      void this.runner.init(expression, { mode: "eval" });
    } else {
      this.executor = new Executor(autoReturn(expression));
    }
  }

  acceptRecord(record: Record): boolean {
    if (this.runner) {
      this.#bufferedRecords.push(record);
      return true;
    }

    let value = this.executor.executeCode(record);
    let result = String(value ?? "");

    if (this.chomp) {
      result = result.replace(/\n+$/, "");
    }

    this.pushLine(result);
    return true;
  }

  override streamDone(): void {
    if (this.runner && this.#bufferedRecords.length > 0) {
      const results = this.runner.executeBatch(this.#bufferedRecords);
      for (const result of results) {
        if (result.error) {
          process.stderr.write(`eval: ${result.error}\n`);
          continue;
        }
        if (result.record) {
          this.pushLine(JSON.stringify(result.record));
        }
      }
    }
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
    "line set to the current line number (starting at 1). " +
    "When --lang is used with a non-JS language, the record is modified by " +
    "the snippet and output as a JSON line.",
  options: [
    {
      flags: ["--chomp"],
      description:
        "Chomp eval results (remove trailing newlines to avoid duplicate " +
        "newlines when already newline-terminated).",
    },
    {
      flags: ["--lang", "-l"],
      description:
        "Snippet language: js (default), python/py, perl/pl.",
      argument: "<lang>",
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
    {
      description: "Add a field using Python",
      command: "recs eval --lang python 'r[\"b\"] = r[\"a\"] + 1'",
    },
  ],
  seeAlso: ["xform", "grep"],
};
