import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Executor, autoReturn } from "../../Executor.ts";
import { Record } from "../../Record.ts";

/**
 * Filter to a range of records delimited from when the begin snippet
 * becomes true to when the end snippet becomes true. Compare to Perl's
 * inclusive, bistable ".." range operator.
 *
 * Analogous to App::RecordStream::Operation::substream in Perl.
 */
export class SubstreamOperation extends Operation {
  extraArgs: string[] = [];
  beginExecutor: Executor | null = null;
  endExecutor: Executor | null = null;
  inSubstream = false;
  seenRecord = false;

  init(args: string[]): void {
    let beginExpr: string | null = null;
    let endExpr: string | null = null;

    const defs: OptionDef[] = [
      {
        long: "begin",
        short: "b",
        type: "string",
        handler: (v) => { beginExpr = v as string; },
        description: "Begin outputting records when this snippet becomes true",
      },
      {
        long: "end",
        short: "e",
        type: "string",
        handler: (v) => { endExpr = v as string; },
        description: "Stop outputting records after this snippet becomes true",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);

    if (beginExpr) {
      this.beginExecutor = new Executor(autoReturn(beginExpr));
    }
    if (endExpr) {
      this.endExecutor = new Executor(autoReturn(endExpr));
    }
  }

  acceptRecord(record: Record): boolean {
    if (!this.inSubstream) {
      if (!this.beginExecutor || this.beginExecutor.executeCode(record)) {
        this.inSubstream = true;
      }
    }

    if (this.inSubstream) {
      this.pushRecord(record);
      this.seenRecord = true;

      if (this.endExecutor && this.endExecutor.executeCode(record)) {
        this.inSubstream = false;
        return false; // Stop processing
      }
    }

    return true;
  }

  override streamDone(): void {
    if (!this.seenRecord) {
      this.setExitValue(1);
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "substream",
  category: "transform",
  synopsis: "recs substream [options] [files...]",
  description:
    "Filter to a range of records delimited from when the begin snippet " +
    "becomes true to when the end snippet becomes true, i.e. [begin, end]. " +
    "Compare to Perl's inclusive, bistable \"..\" range operator.",
  options: [
    {
      flags: ["--begin", "-b"],
      description:
        "Begin outputting records when this snippet becomes true. " +
        "If omitted, output starts from the beginning of the stream.",
      argument: "<snippet>",
    },
    {
      flags: ["--end", "-e"],
      description:
        "Stop outputting records after this snippet becomes true. " +
        "If omitted, outputs to the end of the stream.",
      argument: "<snippet>",
    },
  ],
  examples: [
    {
      description: "Filter to records within a specific time window",
      command:
        "recs substream -b 'r.time >= \"2013-11-07 22:42\"' -e 'r.time > \"2013-11-07 22:43\"'",
    },
    {
      description: "Truncate past a specific date",
      command: "recs substream -e 'r.endTime.includes(\"Nov 07\")'",
    },
  ],
  seeAlso: ["grep"],
};
