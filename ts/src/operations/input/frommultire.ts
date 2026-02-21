import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { setKey } from "../../KeySpec.ts";

interface RegexDef {
  pattern: RegExp;
  fields: string[];
  preFlush: boolean;
  postFlush: boolean;
}

/**
 * Match multiple regex patterns against lines, accumulating fields.
 *
 * Analogous to App::RecordStream::Operation::frommultire in Perl.
 */
export class FromMultiRe extends Operation {
  regexes: RegexDef[] = [];
  clobber = false;
  keepAll = false;
  keepFields: Set<string> = new Set();
  currentRecord: Record = new Record();

  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "no-flush-regex",
        type: "string",
        handler: (v) => {
          this.addRegex(v as string, false, false);
        },
        description: "Add a normal regex",
      },
      {
        long: "regex",
        type: "string",
        handler: (v) => {
          this.addRegex(v as string, false, false);
        },
        description: "Add a normal regex",
      },
      {
        long: "re",
        type: "string",
        handler: (v) => {
          this.addRegex(v as string, false, false);
        },
        description: "Add a normal regex",
      },
      {
        long: "pre-flush-regex",
        type: "string",
        handler: (v) => {
          this.addRegex(v as string, true, false);
        },
        description: "Flush before interpreting fields",
      },
      {
        long: "pre",
        type: "string",
        handler: (v) => {
          this.addRegex(v as string, true, false);
        },
        description: "Flush before interpreting fields",
      },
      {
        long: "post-flush-regex",
        type: "string",
        handler: (v) => {
          this.addRegex(v as string, false, true);
        },
        description: "Flush after interpreting fields",
      },
      {
        long: "post",
        type: "string",
        handler: (v) => {
          this.addRegex(v as string, false, true);
        },
        description: "Flush after interpreting fields",
      },
      {
        long: "double-flush-regex",
        type: "string",
        handler: (v) => {
          this.addRegex(v as string, true, true);
        },
        description: "Flush before and after",
      },
      {
        long: "double",
        type: "string",
        handler: (v) => {
          this.addRegex(v as string, true, true);
        },
        description: "Flush before and after",
      },
      {
        long: "clobber",
        type: "boolean",
        handler: () => {
          this.clobber = true;
        },
        description: "Do not flush on field collisions or at EOF",
      },
      {
        long: "keep-all",
        type: "boolean",
        handler: () => {
          this.keepAll = true;
        },
        description: "Do not clear any fields on flush",
      },
      {
        long: "keep",
        type: "string",
        handler: (v) => {
          for (const f of (v as string).split(",")) {
            this.keepFields.add(f);
          }
        },
        description: "Fields to keep on flush",
      },
    ];

    this.parseOptions(args, defs);
  }

  addRegex(
    spec: string,
    preFlush: boolean,
    postFlush: boolean
  ): void {
    let patternStr = spec;
    let fields: string[] = [];

    // Parse "field1,field2=regex" syntax
    const eqIndex = spec.indexOf("=");
    if (eqIndex !== -1) {
      const fieldPart = spec.slice(0, eqIndex);
      patternStr = spec.slice(eqIndex + 1);
      fields = fieldPart.split(",");
    }

    this.regexes.push({
      pattern: new RegExp(patternStr),
      fields,
      preFlush,
      postFlush,
    });
  }

  processLine(line: string): void {
    let regexIndex = 0;
    for (const regex of this.regexes) {
      const fieldPrefix = `${regexIndex}-`;
      const match = regex.pattern.exec(line);

      if (match) {
        const groups = Array.from(match).slice(1);
        const pairs = this.getFieldValuePairs(groups, regex.fields, fieldPrefix);

        let preFlush = regex.preFlush;

        if (!this.clobber) {
          // Check for field collisions
          const data = this.currentRecord.dataRef();
          for (const [name] of pairs) {
            if (data[name] !== undefined) {
              preFlush = true;
            }
          }
        }

        if (preFlush) {
          this.flushRecord();
        }

        const data = this.currentRecord.dataRef();
        for (const [name, value] of pairs) {
          setKey(data, name, value);
        }

        if (regex.postFlush) {
          this.flushRecord();
        }
      }
      regexIndex++;
    }
  }

  getFieldValuePairs(
    groups: string[],
    fields: string[],
    prefix: string
  ): [string, string][] {
    const fieldNames: string[] = [];
    const groupsUsed = new Set<number>();

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]!;
      const dollarMatch = field.match(/^\$(\d+)$/);
      if (dollarMatch) {
        const n = parseInt(dollarMatch[1]!, 10) - 1;
        fieldNames.push(groups[n] ?? field);
        groupsUsed.add(n);
      } else {
        fieldNames.push(field);
      }
    }

    const pairs: [string, string][] = [];
    let pairIndex = 0;
    for (let i = 0; i < groups.length; i++) {
      if (groupsUsed.has(i)) continue;
      const fieldName =
        pairIndex < fieldNames.length
          ? fieldNames[pairIndex]!
          : `${prefix}${pairIndex}`;
      pairs.push([fieldName, groups[i]!]);
      pairIndex++;
    }

    return pairs;
  }

  flushRecord(): void {
    const record = this.currentRecord;
    if (record.keys().length === 0) return;

    const newRecord = new Record();
    for (const field of record.keys()) {
      if (this.keepAll || this.keepFields.has(field)) {
        newRecord.set(field, record.get(field)!);
      }
    }

    this.pushRecord(record);
    this.currentRecord = newRecord;
  }

  override acceptLine(line: string): boolean {
    this.processLine(line);
    return true;
  }

  override streamDone(): void {
    if (!this.clobber && this.currentRecord.keys().length > 0) {
      this.flushRecord();
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "frommultire",
  category: "input",
  synopsis: "recs frommultire [options] [<files>]",
  description:
    "Match multiple regexes against each line of input (or lines of <files>). Various parameters control when the accumulated fields are flushed to output as a record and which, if any, fields are cleared when the record is flushed. By default regexes do not necessarily flush on either side, would-be field collisions cause a flush, EOF causes a flush if any fields are set, and all fields are cleared on a flush. Regex syntax is: '<KEY1>,<KEY2>=REGEX'. KEY field names are optional. If a field matches $NUM, then that match number in the regex will be used as the field name.",
  options: [
    {
      flags: ["--no-flush-regex", "--regex", "--re"],
      argument: "<regex>",
      description: "Add a normal regex (no flushing).",
    },
    {
      flags: ["--pre-flush-regex", "--pre"],
      argument: "<regex>",
      description: "Add a regex that flushes before interpreting fields when matched.",
    },
    {
      flags: ["--post-flush-regex", "--post"],
      argument: "<regex>",
      description: "Add a regex that flushes after interpreting fields when matched.",
    },
    {
      flags: ["--double-flush-regex", "--double"],
      argument: "<regex>",
      description: "Add a regex that flushes both before and after interpreting fields when matched.",
    },
    {
      flags: ["--clobber"],
      description:
        "Do not flush records when a field from a match would clobber an already existing field and do not flush at EOF.",
    },
    {
      flags: ["--keep-all"],
      description: "Do not clear any fields on a flush.",
    },
    {
      flags: ["--keep"],
      argument: "<fields>",
      description: "Do not clear this comma separated list of fields on a flush.",
    },
  ],
  examples: [
    {
      description: "Parse several fields on separate lines",
      command:
        "recs frommultire --re 'fname,lname=^Name: (.*) (.*)$' --re 'addr=^Address: (.*)$'",
    },
    {
      description: "Some fields apply to multiple records (department here)",
      command:
        "recs frommultire --post 'fname,lname=^Name: (.*) (.*)$' --re 'department=^Department: (.*)$' --clobber --keep team",
    },
  ],
  seeAlso: ["fromre"],
};
