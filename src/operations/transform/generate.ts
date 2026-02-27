import { spawnSync } from "node:child_process";
import { Operation } from "../../Operation.ts";
import type { OptionDef } from "../../Operation.ts";
import { Executor, autoReturn, snippetFromFileOption, executorCommandDocOptions } from "../../Executor.ts";
import { Record } from "../../Record.ts";
import type { JsonObject, JsonValue } from "../../types/json.ts";
import { findKey, setKey } from "../../KeySpec.ts";
import type { SnippetRunner } from "../../snippets/SnippetRunner.ts";
import { createSnippetRunner, isJsLang, langOptionDef } from "../../snippets/index.ts";

/**
 * Generate new records from a JS snippet. The snippet returns an array
 * of new records (or a single record). Each generated record gets a
 * chain-link back to the original input record.
 *
 * In the Perl version this executes a shell command and reads JSON lines
 * from its output. In the TS version the snippet returns records directly.
 *
 * Analogous to App::RecordStream::Operation::generate in Perl.
 */
export class GenerateOperation extends Operation {
  extraArgs: string[] = [];
  executor!: Executor;
  keychain = "_chain";
  passthrough = false;
  shellMode = false;
  shellCommand = "";
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
        long: "keychain",
        type: "string",
        handler: (v) => { this.keychain = v as string; },
        description: "Key name for the chain link (default '_chain')",
      },
      {
        long: "passthrough",
        type: "boolean",
        handler: () => { this.passthrough = true; },
        description: "Emit input record in addition to generated records",
      },
      {
        long: "shell",
        type: "boolean",
        handler: () => { this.shellMode = true; },
        description: "Execute the expression as a shell command instead of a code snippet. " +
          "Each line of stdout is parsed as a JSON record. " +
          "Use {{keyspec}} for template interpolation from the input record.",
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

    let expression: string;
    if (fileSnippet ?? exprSnippet) {
      expression = (fileSnippet ?? exprSnippet)!;
      this.extraArgs = remaining;
    } else {
      if (remaining.length === 0) {
        throw new Error("generate requires an expression argument");
      }
      expression = remaining[0]!;
      this.extraArgs = remaining.slice(1);
    }

    if (this.shellMode) {
      this.shellCommand = expression;
    } else if (this.lang && !isJsLang(this.lang)) {
      this.runner = createSnippetRunner(this.lang);
      void this.runner.init(expression, { mode: "generate" });
    } else {
      this.executor = new Executor(autoReturn(expression));
    }
  }

  acceptRecord(record: Record): boolean {
    if (this.runner) {
      this.bufferedRecords.push(record);
      return true;
    }

    if (this.passthrough) {
      this.pushRecord(record);
    }

    if (this.shellMode) {
      this.executeShellCommand(record);
      return true;
    }

    const result = this.executor.executeCode(record);

    // Result should be an array of records (or objects)
    const items = Array.isArray(result) ? result : (result ? [result] : []);

    for (const item of items) {
      let genRecord: Record;
      if (item instanceof Record) {
        genRecord = item;
      } else if (typeof item === "object" && item !== null) {
        genRecord = new Record(item as JsonObject);
      } else {
        continue;
      }

      // Add chain link to original record
      setKey(
        genRecord.dataRef() as JsonObject,
        this.keychain,
        record.toJSON() as JsonValue
      );
      this.pushRecord(genRecord);
    }

    return true;
  }

  /**
   * Interpolate {{keyspec}} placeholders in a shell command using values
   * from the given record, then execute the command and parse each line
   * of stdout as a JSON record.
   */
  executeShellCommand(record: Record): void {
    // Interpolate {{keyspec}} with record values
    const command = this.shellCommand.replace(
      /\{\{(.*?)\}\}/g,
      (_match, keyspec: string) => {
        const value = findKey(record.dataRef() as JsonObject, "@" + keyspec);
        if (value === undefined || value === null) return "";
        return String(value);
      }
    );

    const result = spawnSync(command, {
      shell: true,
      encoding: "utf-8",
      maxBuffer: 100 * 1024 * 1024, // 100MB
    });

    if (result.error) {
      process.stderr.write(`generate: shell command failed: ${result.error.message}\n`);
      return;
    }

    if (result.status !== 0) {
      const stderr = result.stderr ? result.stderr.trim() : "";
      process.stderr.write(
        `generate: shell command exited with status ${result.status}${stderr ? ": " + stderr : ""}\n`
      );
      return;
    }

    if (result.stderr && result.stderr.trim()) {
      process.stderr.write(result.stderr);
    }

    const output = result.stdout ?? "";
    const lines = output.split("\n").filter((line: string) => line.trim() !== "");
    for (const line of lines) {
      try {
        const genRecord = Record.fromJSON(line);
        setKey(
          genRecord.dataRef() as JsonObject,
          this.keychain,
          record.toJSON() as JsonValue
        );
        this.pushRecord(genRecord);
      } catch {
        process.stderr.write(`generate: failed to parse JSON from shell output: ${line}\n`);
      }
    }
  }

  override streamDone(): void {
    if (this.runner && this.bufferedRecords.length > 0) {
      const results = this.runner.executeBatch(this.bufferedRecords);
      for (let i = 0; i < results.length; i++) {
        const result = results[i]!;
        const inputRecord = this.bufferedRecords[i]!;

        if (result.error) {
          process.stderr.write(`generate: ${result.error}\n`);
          continue;
        }

        if (this.passthrough) {
          this.pushRecord(inputRecord);
        }

        if (result.records) {
          for (const rec of result.records) {
            const genRecord = new Record(rec as JsonObject);
            // Add chain link to original record
            setKey(
              genRecord.dataRef() as JsonObject,
              this.keychain,
              inputRecord.toJSON() as JsonValue
            );
            this.pushRecord(genRecord);
          }
        }
      }
    }
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "generate",
  category: "transform",
  synopsis: "recs generate [options] <expression> [files...]",
  description:
    "Execute an expression for each record to generate new records. " +
    "The expression should return an array of new record objects (or a single " +
    "record). Each generated record gets a chain link back to the original " +
    "input record under the '_chain' key (configurable via --keychain). " +
    "With --shell, the expression is executed as a shell command and each line " +
    "of stdout is parsed as a JSON record. Use {{keyspec}} for template " +
    "interpolation from the input record in shell commands.",
  options: [
    {
      flags: ["--keychain"],
      description:
        "Key name for the chain link back to the original record. Default is '_chain'. " +
        "May be a key spec.",
      argument: "<name>",
    },
    {
      flags: ["--passthrough"],
      description: "Emit the input record in addition to the generated records.",
    },
    {
      flags: ["--shell"],
      description:
        "Execute the expression as a shell command instead of a code snippet. " +
        "Each line of stdout is parsed as a JSON record. " +
        "Use {{keyspec}} for template interpolation from the input record.",
    },
    ...executorCommandDocOptions(),
  ],
  examples: [
    {
      description:
        "Generate sub-records from a feed and chain back to the original",
      command:
        "recs generate 'fetchFeed(r.url).map(item => ({ title: item.title }))'",
    },
    {
      description: "Execute a shell command to generate JSON records",
      command: "recs generate --shell 'echo {\"x\": 1}'",
    },
    {
      description: "Shell command with template interpolation from input record",
      command: "recs generate --shell 'echo {\"name\": \"{{name}}\"}'",
    },
  ],
  seeAlso: ["xform", "chain"],
};
