import { Record } from "./Record.ts";
import type { JsonObject } from "./types/json.ts";
import { Executor } from "./Executor.ts";
import { findKey } from "./KeySpec.ts";
import type { AnyAggregator } from "./Aggregator.ts";
import { mapInitial, mapCombine, mapSquish } from "./Aggregator.ts";

/**
 * Fluent pipeline API for RecordStream.
 *
 * Provides a lazy, chainable API for building record processing pipelines.
 * All transforms return a new RecordStream (immutable chain).
 * Terminal operations (toArray, toJsonLines, etc.) trigger evaluation.
 *
 * Internally uses async iterables for lazy evaluation.
 */
export class RecordStream {
  #source: AsyncIterable<Record>;

  constructor(source: AsyncIterable<Record>) {
    this.#source = source;
  }

  // ─── Static Constructors ───────────────────────────────────────

  /**
   * Create a RecordStream from JSON lines (newline-delimited JSON).
   */
  static fromJsonLines(input: string | ReadableStream<Uint8Array>): RecordStream {
    if (typeof input === "string") {
      return new RecordStream(jsonLinesFromString(input));
    }
    return new RecordStream(jsonLinesFromStream(input));
  }

  /**
   * Create a RecordStream from a JSON array.
   */
  static fromJsonArray(input: string | JsonObject[]): RecordStream {
    const arr =
      typeof input === "string"
        ? (JSON.parse(input) as JsonObject[])
        : input;
    return new RecordStream(arrayToAsyncIter(arr.map((obj) => new Record(obj))));
  }

  /**
   * Create a RecordStream from CSV text.
   * First line is headers, subsequent lines are values.
   */
  static fromCsv(input: string): RecordStream {
    return new RecordStream(csvToRecords(input));
  }

  /**
   * Create a RecordStream from an array of Records.
   */
  static fromRecords(records: Record[]): RecordStream {
    return new RecordStream(arrayToAsyncIter(records));
  }

  /**
   * Create a RecordStream from an async iterable of Records.
   */
  static fromAsyncIterable(source: AsyncIterable<Record>): RecordStream {
    return new RecordStream(source);
  }

  /**
   * Create an empty RecordStream.
   */
  static empty(): RecordStream {
    return new RecordStream(arrayToAsyncIter([]));
  }

  // ─── Transforms (return new RecordStream) ─────────────────────

  /**
   * Filter records by a predicate function or code snippet.
   */
  grep(predicate: string | ((r: Record) => boolean)): RecordStream {
    const fn =
      typeof predicate === "string"
        ? makeRecordPredicate(predicate)
        : predicate;
    const src = this.#source;
    return new RecordStream(filterAsync(src, fn));
  }

  /**
   * Evaluate a code snippet against each record (for side effects like
   * adding/modifying fields). The record is modified in-place.
   */
  eval(snippet: string): RecordStream {
    const executor = new Executor(`${snippet}; return r;`);
    const src = this.#source;
    return new RecordStream(
      mapAsync(src, (r) => {
        executor.executeCode(r);
        return r;
      })
    );
  }

  /**
   * Transform each record, potentially producing multiple output records.
   * The function should return an array of records for each input.
   */
  xform(
    snippetOrFn: string | ((r: Record) => Record[])
  ): RecordStream {
    const fn =
      typeof snippetOrFn === "string"
        ? makeRecordXform(snippetOrFn)
        : snippetOrFn;
    const src = this.#source;
    return new RecordStream(flatMapAsync(src, fn));
  }

  /**
   * Sort records by one or more key specs.
   * This is a buffering operation (must consume all input).
   */
  sort(...keys: string[]): RecordStream {
    const src = this.#source;
    return new RecordStream(sortAsync(src, keys));
  }

  /**
   * Keep only unique records by the given key specs.
   * Records must be sorted by the given keys for correct results.
   */
  uniq(...keys: string[]): RecordStream {
    const src = this.#source;
    return new RecordStream(uniqAsync(src, keys));
  }

  /**
   * Take the first N records.
   */
  head(n: number): RecordStream {
    const src = this.#source;
    return new RecordStream(takeAsync(src, n));
  }

  /**
   * Skip the first N records and emit the rest.
   */
  tail(n: number): RecordStream {
    const src = this.#source;
    return new RecordStream(skipAsync(src, n));
  }

  /**
   * Apply aggregators grouped by keys.
   */
  collate(options: CollateOptions): RecordStream {
    const src = this.#source;
    return new RecordStream(collateAsync(src, options));
  }

  /**
   * Map each record to a new record using a function.
   */
  map(fn: (r: Record) => Record): RecordStream {
    const src = this.#source;
    return new RecordStream(mapAsync(src, fn));
  }

  /**
   * Reverse the order of records (buffering operation).
   */
  reverse(): RecordStream {
    const src = this.#source;
    return new RecordStream(reverseAsync(src));
  }

  /**
   * Flatten array fields into separate records.
   */
  decollate(field: string): RecordStream {
    const src = this.#source;
    return new RecordStream(
      flatMapAsync(src, (r) => {
        const val = findKey(r.dataRef(), field);
        if (!Array.isArray(val)) return [r];
        return val.map((item) => {
          const clone = r.clone();
          clone.set(field, item);
          return clone;
        });
      })
    );
  }

  /**
   * Chain another RecordStream after this one.
   */
  concat(other: RecordStream): RecordStream {
    const src1 = this.#source;
    const src2 = other.#source;
    return new RecordStream(concatAsync(src1, src2));
  }

  // ─── Terminal Operations ──────────────────────────────────────

  /**
   * Collect all records into an array.
   */
  async toArray(): Promise<Record[]> {
    const result: Record[] = [];
    for await (const record of this.#source) {
      result.push(record);
    }
    return result;
  }

  /**
   * Convert to an array of plain JSON objects.
   */
  async toJsonArray(): Promise<JsonObject[]> {
    const records = await this.toArray();
    return records.map((r) => r.toJSON());
  }

  /**
   * Convert to JSON lines string.
   */
  async toJsonLines(): Promise<string> {
    const lines: string[] = [];
    for await (const record of this.#source) {
      lines.push(record.toString());
    }
    return lines.join("\n") + "\n";
  }

  /**
   * Convert to CSV string.
   */
  async toCsv(): Promise<string> {
    const records = await this.toArray();
    if (records.length === 0) return "";

    const keys = records[0]!.keys();
    const header = keys.map(csvEscape).join(",");
    const rows = records.map((r) =>
      keys.map((k) => csvEscape(String(r.get(k) ?? ""))).join(",")
    );
    return [header, ...rows].join("\n") + "\n";
  }

  /**
   * Pipe records to a writable stream as JSON lines.
   */
  async pipe(writable: WritableStream<string>): Promise<void> {
    const writer = writable.getWriter();
    try {
      for await (const record of this.#source) {
        await writer.write(record.toString() + "\n");
      }
    } finally {
      await writer.close();
    }
  }

  /**
   * Get the async iterable source for manual iteration.
   */
  [Symbol.asyncIterator](): AsyncIterator<Record> {
    return this.#source[Symbol.asyncIterator]();
  }
}

// ─── CollateOptions ───────────────────────────────────────────────

export interface CollateOptions {
  /** Key specs to group by */
  keys?: string[];
  /** Map of output_name -> Aggregator */
  aggregators: Map<string, AnyAggregator>;
}

// ─── Internal async iterable helpers ─────────────────────────────

async function* jsonLinesFromString(input: string): AsyncIterable<Record> {
  for (const line of input.split("\n")) {
    const trimmed = line.trim();
    if (trimmed !== "") {
      yield Record.fromJSON(trimmed);
    }
  }
}

async function* jsonLinesFromStream(
  readable: ReadableStream<Uint8Array>
): AsyncIterable<Record> {
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line !== "") {
          yield Record.fromJSON(line);
        }
      }
    }

    // Handle remaining content
    const remaining = buffer.trim();
    if (remaining !== "") {
      yield Record.fromJSON(remaining);
    }
  } finally {
    reader.releaseLock();
  }
}

async function* csvToRecords(input: string): AsyncIterable<Record> {
  const lines = input.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return;

  const headers = parseCsvLine(lines[0]!);
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!);
    const obj: JsonObject = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]!;
      const val = values[j] ?? "";
      // Try to parse as number
      const num = Number(val);
      obj[header] = val === "" ? "" : isNaN(num) ? val : num;
    }
    yield new Record(obj);
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

async function* arrayToAsyncIter<T>(arr: T[]): AsyncIterable<T> {
  for (const item of arr) {
    yield item;
  }
}

async function* filterAsync(
  source: AsyncIterable<Record>,
  fn: (r: Record) => boolean
): AsyncIterable<Record> {
  for await (const record of source) {
    if (fn(record)) yield record;
  }
}

async function* mapAsync(
  source: AsyncIterable<Record>,
  fn: (r: Record) => Record
): AsyncIterable<Record> {
  for await (const record of source) {
    yield fn(record);
  }
}

async function* flatMapAsync(
  source: AsyncIterable<Record>,
  fn: (r: Record) => Record[]
): AsyncIterable<Record> {
  for await (const record of source) {
    for (const out of fn(record)) {
      yield out;
    }
  }
}

async function* sortAsync(
  source: AsyncIterable<Record>,
  keys: string[]
): AsyncIterable<Record> {
  const all: Record[] = [];
  for await (const record of source) {
    all.push(record);
  }
  const sorted = Record.sort(all, ...keys);
  for (const record of sorted) {
    yield record;
  }
}

async function* uniqAsync(
  source: AsyncIterable<Record>,
  keys: string[]
): AsyncIterable<Record> {
  let last: Record | null = null;
  for await (const record of source) {
    if (last === null || last.cmp(record, ...keys) !== 0) {
      yield record;
      last = record;
    }
  }
}

async function* takeAsync(
  source: AsyncIterable<Record>,
  n: number
): AsyncIterable<Record> {
  let count = 0;
  for await (const record of source) {
    if (count >= n) break;
    yield record;
    count++;
  }
}

async function* skipAsync(
  source: AsyncIterable<Record>,
  n: number
): AsyncIterable<Record> {
  let count = 0;
  for await (const record of source) {
    if (count >= n) {
      yield record;
    }
    count++;
  }
}

async function* reverseAsync(
  source: AsyncIterable<Record>
): AsyncIterable<Record> {
  const all: Record[] = [];
  for await (const record of source) {
    all.push(record);
  }
  for (let i = all.length - 1; i >= 0; i--) {
    yield all[i]!;
  }
}

async function* collateAsync(
  source: AsyncIterable<Record>,
  options: CollateOptions
): AsyncIterable<Record> {
  const { keys = [], aggregators } = options;

  // Group records by keys
  const groups = new Map<string, { keyValues: JsonObject; cookies: Map<string, unknown> }>();
  const groupOrder: string[] = [];

  for await (const record of source) {
    // Build group key
    const keyValues: JsonObject = {};
    const keyParts: string[] = [];
    for (const key of keys) {
      const val = findKey(record.dataRef(), key);
      keyValues[key] = val ?? null;
      keyParts.push(JSON.stringify(val));
    }
    const groupKey = keyParts.join("|");

    let group = groups.get(groupKey);
    if (!group) {
      group = { keyValues, cookies: mapInitial(aggregators) };
      groups.set(groupKey, group);
      groupOrder.push(groupKey);
    }

    group.cookies = mapCombine(aggregators, group.cookies, record);
  }

  // Produce output records
  for (const groupKey of groupOrder) {
    const group = groups.get(groupKey)!;
    const squished = mapSquish(aggregators, group.cookies);

    const outData: JsonObject = { ...group.keyValues };
    for (const [name, value] of squished) {
      outData[name] = value;
    }

    yield new Record(outData);
  }
}

async function* concatAsync(
  a: AsyncIterable<Record>,
  b: AsyncIterable<Record>
): AsyncIterable<Record> {
  for await (const record of a) yield record;
  for await (const record of b) yield record;
}

// ─── Code snippet helpers ────────────────────────────────────────

function makeRecordPredicate(snippet: string): (r: Record) => boolean {
  const executor = new Executor(`return (${snippet})`);
  return (r: Record) => !!executor.executeCode(r);
}

function makeRecordXform(snippet: string): (r: Record) => Record[] {
  const executor = new Executor(snippet);
  return (r: Record) => {
    const result = executor.executeCode(r);
    if (Array.isArray(result)) return result as Record[];
    return [r];
  };
}
