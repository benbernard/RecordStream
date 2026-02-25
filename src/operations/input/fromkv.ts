import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import type { JsonObject } from "../../types/json.ts";

/**
 * Parse key=value pair input into records.
 *
 * Analogous to App::RecordStream::Operation::fromkv in Perl.
 */
export class FromKv extends Operation {
  kvDelim = " ";
  entryDelim = "\n";
  recordDelim = "END\n";
  acc: string | null = null;
  extraArgs: string[] = [];

  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "kv-delim",
        short: "f",
        type: "string",
        handler: (v) => {
          this.kvDelim = v as string;
        },
        description: "Key/value delimiter (default ' ')",
      },
      {
        long: "entry-delim",
        short: "e",
        type: "string",
        handler: (v) => {
          this.entryDelim = v as string;
        },
        description: "Entry delimiter (default newline)",
      },
      {
        long: "record-delim",
        short: "r",
        type: "string",
        handler: (v) => {
          this.recordDelim = v as string;
        },
        description: "Record delimiter (default 'END\\n')",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);
  }

  override acceptLine(line: string): boolean {
    if (this.acc === null) {
      this.acc = "";
    }
    this.acc += `${line}\n`;

    const delimIndex = this.acc.indexOf(this.recordDelim);
    if (delimIndex !== -1) {
      const recordStr = this.acc.slice(0, delimIndex);
      this.acc = this.acc.slice(delimIndex + this.recordDelim.length);
      if (this.acc === "") {
        this.acc = null;
      }
      this.processRecord(recordStr);
    }

    return true;
  }

  override streamDone(): void {
    if (this.acc !== null) {
      this.processRecord(this.acc);
      this.acc = null;
    }
  }

  processRecord(text: string): void {
    // Trim leading/trailing whitespace
    const trimmed = text.trim();
    if (trimmed === "") return;

    const entries = trimmed.split(this.entryDelim);
    if (entries.length === 0) return;

    const data: JsonObject = {};

    for (const entry of entries) {
      const parts = entry.split(this.kvDelim);
      if (parts.length === 2) {
        data[parts[0]!] = parts[1]!;
      }
    }

    this.pushRecord(new Record(data));
  }

  /**
   * Parse content directly (for file-based processing).
   */
  parseContent(content: string): void {
    // Process entire content at once
    const lines = content.split("\n");
    for (const line of lines) {
      this.acceptLine(line);
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromkv",
  category: "input",
  synopsis: "recs fromkv [options] [<files>]",
  description:
    "Records are generated from character input with the form \"<record><record-delim><record>...\". Records have the form \"<entry><entry-delim><entry>...\". Entries are pairs of the form \"<key><kv-delim><value>\".",
  options: [
    {
      flags: ["--kv-delim", "-f"],
      argument: "<delim>",
      description: "Delimiter for separating key/value pairs within an entry (default ' ').",
    },
    {
      flags: ["--entry-delim", "-e"],
      argument: "<delim>",
      description: "Delimiter for separating entries within records (default '\\n').",
    },
    {
      flags: ["--record-delim", "-r"],
      argument: "<delim>",
      description: "Delimiter for separating records (default 'END\\n').",
    },
  ],
  examples: [
    {
      description: "Parse memcached stat metrics into records",
      command:
        "echo -ne 'stats\\r\\n' | nc -i1 localhost 11211 | tr -d '\\r' | awk '{if (! /END/) {print $2\" \"$3} else {print $0}}' | recs fromkv",
    },
    {
      description:
        "Parse records separated by 'E\\n' with entries separated by '|' and pairs separated by '='",
      command: "recs fromkv --kv-delim '=' --entry-delim '|' --record-delim $(echo -ne 'E\\n')",
    },
  ],
};
