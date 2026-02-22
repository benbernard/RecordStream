import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Executor, autoReturn, snippetFromFileOption } from "../../Executor.ts";
import { Record } from "../../Record.ts";
import type { SnippetRunner } from "../../snippets/SnippetRunner.ts";
import { createSnippetRunner, isJsLang, langOptionDef } from "../../snippets/index.ts";

/**
 * Filter records where a JS expression returns truthy.
 *
 * Analogous to App::RecordStream::Operation::grep in Perl.
 */
export class GrepOperation extends Operation {
  executor!: Executor;
  antiMatch = false;
  afterCount = 0;
  beforeCount = 0;
  accumulator: Record[] = [];
  forcedOutput = 0;
  seenRecord = false;
  lang: string | null = null;
  runner: SnippetRunner | null = null;
  #bufferedRecords: Record[] = [];

  override addHelpTypes(): void {
    this.useHelpType("snippet");
    this.useHelpType("keyspecs");
  }

  init(args: string[]): void {
    let context = 0;
    let fileSnippet: string | null = null;

    const defs: OptionDef[] = [
      {
        long: "invert-match",
        short: "v",
        type: "boolean",
        handler: () => { this.antiMatch = true; },
        description: "Anti-match: records NOT matching expr will be returned",
      },
      {
        long: "context",
        short: "C",
        type: "number",
        handler: (v) => { context = Number(v); },
        description: "Provide NUM records of context around matches",
      },
      {
        long: "after-context",
        short: "A",
        type: "number",
        handler: (v) => { this.afterCount = Number(v); },
        description: "Print out NUM following records after a match",
      },
      {
        long: "before-context",
        short: "B",
        type: "number",
        handler: (v) => { this.beforeCount = Number(v); },
        description: "Print out the previous NUM records on a match",
      },
      snippetFromFileOption((code) => { fileSnippet = code; }),
      langOptionDef((v) => { this.lang = v; }),
    ];

    const remaining = this.parseOptions(args, defs);

    if (context > 0) {
      this.afterCount = context;
      this.beforeCount = context;
    }

    const expression = fileSnippet ?? remaining.join(" ");
    if (!expression) {
      throw new Error("grep requires an expression argument");
    }

    if (this.lang && !isJsLang(this.lang)) {
      this.runner = createSnippetRunner(this.lang);
      void this.runner.init(expression, { mode: "grep" });
    } else {
      this.executor = new Executor(autoReturn(expression));
    }
  }

  acceptRecord(record: Record): boolean {
    if (this.runner) {
      this.#bufferedRecords.push(record);
      return true;
    }

    let result = this.executor.executeCode(record);
    if (this.antiMatch) {
      result = !result;
    }

    let pushedRecord = false;

    if (result) {
      // Flush before-context buffer
      if (this.beforeCount > 0) {
        while (this.accumulator.length > 0) {
          this.pushRecord(this.accumulator.shift()!);
        }
      }

      this.pushRecord(record);
      pushedRecord = true;
      this.seenRecord = true;

      if (this.afterCount > 0) {
        this.forcedOutput = this.afterCount;
      }
    } else if (this.beforeCount > 0) {
      this.accumulator.push(record);
      if (this.accumulator.length > this.beforeCount) {
        this.accumulator.shift();
      }
    }

    if (this.forcedOutput > 0 && !pushedRecord) {
      this.pushRecord(record);
      this.forcedOutput--;
    }

    return true;
  }

  override streamDone(): void {
    if (this.runner && this.#bufferedRecords.length > 0) {
      const results = this.runner.executeBatch(this.#bufferedRecords);
      for (let i = 0; i < results.length; i++) {
        const result = results[i]!;
        if (result.error) {
          process.stderr.write(`grep: ${result.error}\n`);
          continue;
        }
        let passed = result.passed ?? false;
        if (this.antiMatch) passed = !passed;
        if (passed) {
          this.pushRecord(this.#bufferedRecords[i]!);
          this.seenRecord = true;
        }
      }
    }

    if (!this.seenRecord) {
      this.setExitValue(1);
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "grep",
  category: "transform",
  synopsis: "recs grep [options] <expression> [files...]",
  description:
    "Filter records where an expression evaluates to true. The expression " +
    "is evaluated on each record with r set to the current Record object and " +
    "line set to the current line number (starting at 1). Records for which " +
    "the expression is truthy are passed through.",
  options: [
    {
      flags: ["--invert-match", "-v"],
      description:
        "Anti-match: records NOT matching the expression will be returned.",
    },
    {
      flags: ["--context", "-C"],
      description:
        "Provide NUM records of context around matches (equivalent to -A NUM and -B NUM).",
      argument: "<NUM>",
    },
    {
      flags: ["--after-context", "-A"],
      description: "Print out NUM following records after a match.",
      argument: "<NUM>",
    },
    {
      flags: ["--before-context", "-B"],
      description: "Print out the previous NUM records on a match.",
      argument: "<NUM>",
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
      description: "Filter to records with field 'name' equal to 'John'",
      command: "recs grep 'r.name === \"John\"'",
    },
    {
      description: "Find records without ppid equal to 3456",
      command: "recs grep -v 'r.ppid === 3456'",
    },
    {
      description: "Filter using Python",
      command: "recs grep --lang python 'r[\"age\"] > 30'",
    },
  ],
  seeAlso: ["xform", "assert", "substream"],
};
