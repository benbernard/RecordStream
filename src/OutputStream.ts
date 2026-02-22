import type { Record } from "./Record.ts";

/**
 * OutputStream writes Records as JSON lines to stdout or a writable stream.
 *
 * Analogous to App::RecordStream::OutputStream in Perl.
 */
export class OutputStream {
  #writer: WritableStreamDefaultWriter<string> | null = null;
  #useStdout: boolean;

  constructor(writable?: WritableStream<string>) {
    if (writable) {
      this.#writer = writable.getWriter();
      this.#useStdout = false;
    } else {
      this.#useStdout = true;
    }
  }

  /**
   * Write a record as a JSON line.
   */
  async write(record: Record): Promise<void> {
    const line = record.toString() + "\n";
    if (this.#useStdout) {
      await Bun.write(Bun.stdout, line);
    } else if (this.#writer) {
      await this.#writer.write(line);
    }
  }

  /**
   * Write a raw string line.
   */
  async writeLine(line: string): Promise<void> {
    const output = line.endsWith("\n") ? line : line + "\n";
    if (this.#useStdout) {
      await Bun.write(Bun.stdout, output);
    } else if (this.#writer) {
      await this.#writer.write(output);
    }
  }

  /**
   * Close the output stream.
   */
  async close(): Promise<void> {
    if (this.#writer) {
      await this.#writer.close();
    }
  }

  /**
   * Convert a record to its wire format string.
   */
  static recordToString(record: Record): string {
    return record.toString();
  }
}
