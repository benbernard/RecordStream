import { Record } from "./Record.ts";

/**
 * InputStream reads JSON lines from stdin, files, or strings and produces
 * Record objects. Supports chaining multiple inputs.
 *
 * Analogous to App::RecordStream::InputStream in Perl.
 */
export class InputStream {
  #lines: string[] | null = null;
  #lineIndex = 0;
  // Using inline type to avoid Bun-specific ReadableStreamDefaultReader incompatibility
  #byteReader: { read(): Promise<{ done: boolean; value?: Uint8Array }> } | null = null;
  #decoder = new TextDecoder();
  #buffer = "";
  #done = false;
  #next: InputStream | null;
  #filename: string;

  constructor(options: {
    next?: InputStream | null;
    filename?: string;
  }) {
    this.#next = options.next ?? null;
    this.#filename = options.filename ?? "UNKNOWN";
  }

  /**
   * Create an InputStream from a string of JSON lines.
   */
  static fromString(str: string, next?: InputStream): InputStream {
    const stream = new InputStream({ next, filename: "STRING_INPUT" });
    stream.#lines = str.split("\n").filter((l) => l.trim() !== "");
    return stream;
  }

  /**
   * Create an InputStream from a file path.
   */
  static fromFile(filePath: string, next?: InputStream): InputStream {
    const stream = new InputStream({ next, filename: filePath });
    stream.#initFile(filePath);
    return stream;
  }

  /**
   * Create an InputStream from a ReadableStream of bytes.
   */
  static fromReadable(
    readable: ReadableStream<Uint8Array>,
    next?: InputStream
  ): InputStream {
    const stream = new InputStream({ next, filename: "STREAM_INPUT" });
    stream.#byteReader = readable.getReader();
    return stream;
  }

  /**
   * Create an InputStream from stdin.
   */
  static fromStdin(next?: InputStream): InputStream {
    return InputStream.fromReadable(Bun.stdin.stream(), next);
  }

  /**
   * GNU-style input: if files are provided, chain them; otherwise use stdin.
   */
  static newMagic(files?: string[]): InputStream {
    if (files && files.length > 0) {
      return InputStream.fromFiles(files);
    }
    return InputStream.fromStdin();
  }

  /**
   * Create a chain of InputStreams from multiple files.
   */
  static fromFiles(files: string[]): InputStream {
    let lastStream: InputStream | undefined;
    for (let i = files.length - 1; i >= 0; i--) {
      lastStream = InputStream.fromFile(files[i]!, lastStream);
    }
    return lastStream!;
  }

  #initFile(filePath: string): void {
    const file = Bun.file(filePath);
    this.#byteReader = file.stream().getReader();
  }

  /**
   * Get the next record from the stream.
   * Returns null when all streams are exhausted.
   */
  async getRecord(): Promise<Record | null> {
    if (this.#done) {
      return this.#callNextRecord();
    }

    // String-based input
    if (this.#lines !== null) {
      if (this.#lineIndex < this.#lines.length) {
        const line = this.#lines[this.#lineIndex]!;
        this.#lineIndex++;
        return Record.fromJSON(line);
      }
      this.#done = true;
      return this.#callNextRecord();
    }

    // Stream-based input
    if (this.#byteReader) {
      const line = await this.#readLine();
      if (line !== null) {
        return Record.fromJSON(line);
      }
      this.#done = true;
      return this.#callNextRecord();
    }

    return null;
  }

  async #readLine(): Promise<string | null> {
    while (true) {
      const newlineIndex = this.#buffer.indexOf("\n");
      if (newlineIndex >= 0) {
        const line = this.#buffer.slice(0, newlineIndex).trim();
        this.#buffer = this.#buffer.slice(newlineIndex + 1);
        if (line !== "") return line;
        continue;
      }

      if (!this.#byteReader) return null;
      const { value, done } = await this.#byteReader.read();
      if (done) {
        // Return any remaining content
        const remaining = this.#buffer.trim();
        this.#buffer = "";
        return remaining !== "" ? remaining : null;
      }
      this.#buffer += this.#decoder.decode(value, { stream: true });
    }
  }

  async #callNextRecord(): Promise<Record | null> {
    if (!this.#next) return null;

    // Flatten chain to prevent deep recursion
    if (this.#next.#done) {
      this.#next = this.#next.#next;
    }
    if (!this.#next) return null;

    return this.#next.getRecord();
  }

  /**
   * Async iterator interface - iterate over all records.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<Record> {
    let record = await this.getRecord();
    while (record !== null) {
      yield record;
      record = await this.getRecord();
    }
  }

  /**
   * Collect all records into an array.
   */
  async toArray(): Promise<Record[]> {
    const records: Record[] = [];
    for await (const record of this) {
      records.push(record);
    }
    return records;
  }

  getFilename(): string {
    if (!this.#done) return this.#filename;
    if (this.#next) return this.#next.getFilename();
    return this.#filename;
  }
}
