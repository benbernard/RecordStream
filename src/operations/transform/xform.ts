import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Executor, snippetFromFileOption } from "../../Executor.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * Transform records with a JS snippet. The snippet can modify $r in place,
 * return a record, return an array of records, or use push_output/push_input.
 *
 * Analogous to App::RecordStream::Operation::xform in Perl.
 */
export class XformOperation extends Operation {
  executor!: Executor;
  beforeCount = 0;
  afterCount = 0;
  beforeArray: Record[] = [];
  afterArray: Record[] = [];
  currentRecord: Record | null = null;
  spooledInput: Record[] = [];
  spooledOutput: Record[] = [];
  suppressR = false;

  override addHelpTypes(): void {
    this.useHelpType("snippet");
    this.useHelpType("keyspecs");
  }

  init(args: string[]): void {
    let postSnippet = "";
    let preSnippet = "";
    let fileSnippet: string | null = null;

    const defs: OptionDef[] = [
      {
        long: "before",
        short: "B",
        type: "number",
        handler: (v) => { this.beforeCount = Number(v); },
        description: "Make NUM records before this one available in B array",
      },
      {
        long: "after",
        short: "A",
        type: "number",
        handler: (v) => { this.afterCount = Number(v); },
        description: "Make NUM records after this one available in A array",
      },
      {
        long: "context",
        short: "C",
        type: "number",
        handler: (v) => { this.beforeCount = Number(v); this.afterCount = Number(v); },
        description: "Make NUM records available in both A and B arrays",
      },
      {
        long: "post-snippet",
        type: "string",
        handler: (v) => { postSnippet = v as string; },
        description: "A snippet to run once the stream has completed",
      },
      {
        long: "pre-snippet",
        type: "string",
        handler: (v) => { preSnippet = v as string; },
        description: "A snippet to run before the stream starts",
      },
      snippetFromFileOption((code) => { fileSnippet = code; }),
    ];

    const remaining = this.parseOptions(args, defs);
    const expression = fileSnippet ?? remaining.join(" ");
    if (!expression) {
      throw new Error("xform requires an expression argument");
    }

    this.executor = this.createExecutor(expression, postSnippet, preSnippet);

    // Execute pre-snippet
    this.executor.executeMethod("pre_xform");
    this.handleSpools();
    // Reset line counter so $line starts at 1 for the first record
    this.executor.resetLine();
  }

  createExecutor(snippet: string, postSnippet: string, preSnippet: string): Executor {
    // The xform snippet runs on each record. If it returns an array, each
    // element becomes a separate output record. Otherwise the (possibly
    // mutated) record is output.
    const xformCode = `${snippet}\n; return r;`;

    const executor = new Executor({
      xform: {
        code: xformCode,
        argNames: ["r", "filename", "B", "A"],
      },
      post_xform: {
        code: postSnippet || "return undefined;",
        argNames: ["r"],
      },
      pre_xform: {
        code: preSnippet || "return undefined;",
        argNames: ["r"],
      },
    });

    return executor;
  }

  acceptRecord(record: Record): boolean {
    if (this.beforeCount === 0 && this.afterCount === 0) {
      return this.runRecordWithContext(record);
    }

    this.afterArray.push(record);

    if (this.afterArray.length > this.afterCount) {
      const newRecord = this.afterArray.shift()!;
      if (this.currentRecord) {
        this.beforeArray.unshift(this.currentRecord);
      }
      this.currentRecord = newRecord;
    }

    if (this.afterArray.length > this.afterCount) {
      const newRecord = this.afterArray.shift()!;
      if (this.beforeArray.length > this.beforeCount) {
        this.beforeArray.pop();
      }
      if (this.currentRecord) {
        this.beforeArray.unshift(this.currentRecord);
      }
      this.currentRecord = newRecord;
    }

    if (this.beforeArray.length > this.beforeCount) {
      this.beforeArray.pop();
    }

    if (!this.currentRecord) {
      return true;
    }

    return this.runRecordWithContext(this.currentRecord, this.beforeArray, this.afterArray);
  }

  override streamDone(): void {
    if (this.afterArray.length > 0) {
      while (this.afterArray.length > 0) {
        const newRecord = this.afterArray.shift()!;
        if (this.currentRecord) {
          this.beforeArray.unshift(this.currentRecord);
        }
        this.currentRecord = newRecord;

        if (this.beforeArray.length > this.beforeCount) {
          this.beforeArray.pop();
        }

        this.runRecordWithContext(this.currentRecord, this.beforeArray, this.afterArray);
      }
    }

    // Execute post-snippet
    this.executor.executeMethod("post_xform");
    this.handleSpools();
  }

  runRecordWithContext(
    record: Record,
    before?: Record[],
    after?: Record[]
  ): boolean {
    const value = this.runXform(record, before, after);

    if (!this.suppressR) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item instanceof Record) {
            this.pushRecord(item);
          } else if (typeof item === "object" && item !== null) {
            this.pushRecord(new Record(item as JsonObject));
          }
        }
      } else if (value instanceof Record) {
        this.pushRecord(value);
      } else if (typeof value === "object" && value !== null) {
        this.pushRecord(new Record(value as JsonObject));
      } else if (value !== null && value !== undefined) {
        this.pushRecord(record);
      }
    }

    return this.handleSpools();
  }

  runXform(
    record: Record,
    before?: Record[],
    after?: Record[]
  ): unknown {
    const bCopy = before ? [...before] : [];
    const aCopy = after ? [...after] : [];

    return this.executor.executeMethod(
      "xform",
      record,
      this.getCurrentFilename(),
      bCopy,
      aCopy
    );
  }

  handleSpools(): boolean {
    this.suppressR = false;

    while (this.spooledOutput.length > 0) {
      const newRecord = this.spooledOutput.shift()!;
      this.pushRecord(newRecord);
    }

    while (this.spooledInput.length > 0) {
      const newRecord = this.spooledInput.shift()!;
      if (!this.acceptRecord(newRecord)) {
        this.spooledInput = [];
        return false;
      }
    }

    return true;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "xform",
  category: "transform",
  synopsis: "recs xform [options] <expression> [files...]",
  description:
    "Transform records with a JS snippet. The expression is evaluated on each " +
    "record with r set to the current Record object. If the expression returns " +
    "an array, each element becomes a separate output record. Otherwise the " +
    "(possibly mutated) record is output. You can also use push_output and " +
    "push_input to control record flow.",
  options: [
    {
      flags: ["--before", "-B"],
      description: "Make NUM records before this one available in the B array.",
      argument: "<NUM>",
    },
    {
      flags: ["--after", "-A"],
      description: "Make NUM records after this one available in the A array.",
      argument: "<NUM>",
    },
    {
      flags: ["--context", "-C"],
      description:
        "Make NUM records available in both the A and B arrays (equivalent to -A NUM -B NUM).",
      argument: "<NUM>",
    },
    {
      flags: ["--post-snippet"],
      description: "A snippet to run once the stream has completed.",
      argument: "<snippet>",
    },
    {
      flags: ["--pre-snippet"],
      description: "A snippet to run before the stream starts.",
      argument: "<snippet>",
    },
  ],
  examples: [
    {
      description: "Add line number to records",
      command: "recs xform 'r.line = line'",
    },
    {
      description: "Rename field old to new and remove field a",
      command: "recs xform 'r.rename(\"old\", \"new\"); r.remove(\"a\")'",
    },
    {
      description: "Remove fields which are not a, b, or c",
      command: "recs xform 'r.prune_to(\"a\", \"b\", \"c\")'",
    },
    {
      description: "Move a value from the previous record to the current record",
      command: "recs xform -B 1 'r.before_val = B[0]'",
    },
  ],
  seeAlso: ["grep", "annotate", "eval"],
};
