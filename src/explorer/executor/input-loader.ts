import type { Record } from "../../Record.ts";
import { Record as RecordClass } from "../../Record.ts";
import type { InputSource } from "../model/types.ts";

/**
 * Load records from an InputSource.
 *
 * - file: reads a JSONL file using Bun.file().text() (avoids ReadableStream
 *   which can trigger a Bun bug that destroys process.stdin)
 * - stdin-capture: returns the stored records directly
 */
export async function loadInputRecords(
  input: InputSource,
): Promise<Record[]> {
  switch (input.source.kind) {
    case "file": {
      const text = await Bun.file(input.source.path).text();
      const lines = text.split("\n");
      const records: Record[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed !== "") {
          records.push(RecordClass.fromJSON(trimmed));
        }
      }
      return records;
    }
    case "stdin-capture": {
      return input.source.records;
    }
  }
}

/**
 * Load raw file content as a string (for bulk-content ops like fromcsv).
 * Only applicable to file-based inputs.
 */
export async function loadInputContent(
  input: InputSource,
): Promise<string> {
  switch (input.source.kind) {
    case "file": {
      const file = Bun.file(input.source.path);
      return file.text();
    }
    case "stdin-capture": {
      // Convert records to JSONL for bulk ops that expect raw content
      return input.source.records.map((r) => r.toString()).join("\n") + "\n";
    }
  }
}
