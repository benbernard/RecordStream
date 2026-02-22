/**
 * Benchmark: Line reading strategies
 *
 * Compares approaches for reading JSONL files line-by-line:
 *   1. InputStream.fromFile — current implementation (ReadableStream + manual buffer)
 *   2. InputStream.fromString — pre-loaded string with split
 *   3. Bulk text + split — Bun.file(path).text() then split('\n')
 *   4. ReadableStream manual buffer (isolated) — same algo as InputStream, no Record parsing
 *   5. Node readline — createInterface from node:readline
 *   6. TextDecoderStream — Web Streams API with pipeThrough
 *   7. Binary newline scan — scan Uint8Array for 0x0A, decode only line segments
 *   8. Bun native stdin — `for await (const line of console)` via subprocess
 *
 * Tests at three sizes: 100, 10K, 100K JSON lines.
 */

import { BenchmarkSuite } from "../bench.ts";
import { InputStream } from "../../../src/InputStream.ts";
import {
  ensureFixtures,
  fixturePath,
  fixtureByteSize,
  generateJsonlString,
} from "../fixtures.ts";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Fixture setup — we need small (100), medium (10K), and a custom 100K file
// ---------------------------------------------------------------------------

const BENCH_SIZES = {
  "100": 100,
  "10K": 10_000,
  "100K": 100_000,
} as const;

function ensureLineReadingFixtures(): void {
  ensureFixtures(["small", "medium"]);

  // Generate 100K fixture if missing
  const path100k = fixturePath("100k.jsonl");
  if (!existsSync(path100k)) {
    console.log("Generating 100K JSONL fixture (100,000 records)...");
    writeFileSync(path100k, generateJsonlString(100_000, 42));
  }
}

/** Map benchmark size labels to fixture file names */
function fixtureFile(sizeLabel: string): string {
  switch (sizeLabel) {
    case "100":
      return "small.jsonl";
    case "10K":
      return "medium.jsonl";
    case "100K":
      return "100k.jsonl";
    default:
      throw new Error(`Unknown size: ${sizeLabel}`);
  }
}

// ---------------------------------------------------------------------------
// Isolated line-reading strategies (no Record parsing overhead)
// ---------------------------------------------------------------------------

/**
 * Strategy: ReadableStream + manual buffer with indexOf.
 * This isolates the core algorithm used by InputStream.#readLine().
 */
async function readLinesManualBuffer(filePath: string): Promise<number> {
  const file = Bun.file(filePath);
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bufferOffset = 0;
  let lineCount = 0;

  while (true) {
    const newlineIndex = buffer.indexOf("\n", bufferOffset);
    if (newlineIndex >= 0) {
      const line = buffer.slice(bufferOffset, newlineIndex).trim();
      bufferOffset = newlineIndex + 1;
      if (line !== "") lineCount++;
      continue;
    }

    const { value, done } = await reader.read();
    if (done) {
      const remaining = buffer.slice(bufferOffset).trim();
      if (remaining !== "") lineCount++;
      break;
    }
    if (bufferOffset > 0) {
      buffer = buffer.slice(bufferOffset);
      bufferOffset = 0;
    }
    buffer += decoder.decode(value, { stream: true });
  }

  return lineCount;
}

/**
 * Strategy: Bulk read with Bun.file().text() then split.
 */
async function readLinesBulkSplit(filePath: string): Promise<number> {
  const text = await Bun.file(filePath).text();
  const lines = text.split("\n");
  let lineCount = 0;
  for (const line of lines) {
    if (line.trim() !== "") lineCount++;
  }
  return lineCount;
}

/**
 * Strategy: Node readline with createInterface.
 */
async function readLinesNodeReadline(filePath: string): Promise<number> {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });
  let lineCount = 0;
  for await (const line of rl) {
    if (line.trim() !== "") lineCount++;
  }
  return lineCount;
}

/**
 * Strategy: ReadableStream with TextDecoderStream (Web Streams API).
 */
async function readLinesTextDecoderStream(filePath: string): Promise<number> {
  const file = Bun.file(filePath);
  const stream = file.stream().pipeThrough(new TextDecoderStream());
  let buffer = "";
  let lineCount = 0;

  for await (const chunk of stream) {
    buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line !== "") lineCount++;
    }
  }
  if (buffer.trim() !== "") lineCount++;
  return lineCount;
}

/**
 * Strategy: Binary newline scan — scan Uint8Array for 0x0A before decoding.
 * Only decodes individual line segments, avoiding full-buffer TextDecoder passes.
 */
async function readLinesBinaryScan(filePath: string): Promise<number> {
  const file = Bun.file(filePath);
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let leftover: Uint8Array | null = null;
  let lineCount = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      if (leftover && leftover.length > 0) {
        const line = decoder.decode(leftover).trim();
        if (line !== "") lineCount++;
      }
      break;
    }

    let chunk: Uint8Array;
    if (leftover && leftover.length > 0) {
      // Merge leftover with new chunk
      const merged = new Uint8Array(leftover.length + value!.length);
      merged.set(leftover);
      merged.set(value!, leftover.length);
      chunk = merged;
    } else {
      chunk = value!;
    }

    let start = 0;
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === 0x0a) {
        // Found newline — decode just the line segment
        if (i > start) {
          const line = decoder.decode(chunk.subarray(start, i)).trim();
          if (line !== "") lineCount++;
        }
        start = i + 1;
      }
    }

    // Save unprocessed bytes as leftover
    if (start < chunk.length) {
      leftover = chunk.subarray(start);
    } else {
      leftover = null;
    }
  }

  return lineCount;
}

/**
 * Strategy: Bun native stdin line reading via subprocess.
 * Spawns a Bun subprocess that uses `for await (const line of console)`
 * with file content piped to its stdin.
 */
async function readLinesBunNativeStdin(filePath: string): Promise<number> {
  const proc = Bun.spawn(
    ["bun", STDIN_READER_SCRIPT],
    {
      stdin: Bun.file(filePath),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Subprocess failed (exit ${exitCode}): ${stderr}`);
  }
  const count = parseInt(output.trim(), 10);
  if (isNaN(count) || count === 0) throw new Error(`Bad line count: ${output}`);
  return count;
}

// ---------------------------------------------------------------------------
// Stdin reader helper script (written to fixtures dir at setup time)
// ---------------------------------------------------------------------------

const STDIN_READER_SCRIPT = join(import.meta.dir, "..", "fixtures", "stdin-reader.ts");

function ensureStdinReaderScript(): void {
  if (existsSync(STDIN_READER_SCRIPT)) return;
  writeFileSync(
    STDIN_READER_SCRIPT,
    `// Auto-generated helper for line-reading benchmarks.
// Reads lines from stdin using Bun's native console async iterator.
let count = 0;
for await (const line of console) {
  if (line.trim() !== "") count++;
}
process.stdout.write(String(count));
`,
  );
}

// ---------------------------------------------------------------------------
// Suite factory
// ---------------------------------------------------------------------------

export function createLineReadingSuite(filter?: string): BenchmarkSuite {
  const suite = new BenchmarkSuite("Line Reading", { filter });

  ensureLineReadingFixtures();
  ensureStdinReaderScript();

  for (const [sizeLabel, recordCount] of Object.entries(BENCH_SIZES)) {
    const file = fixtureFile(sizeLabel);
    const filePath = fixturePath(file);
    const byteCount = fixtureByteSize(file);
    const iterations = recordCount <= 100 ? 20 : recordCount <= 10_000 ? 10 : 5;

    // Pre-load the string content for fromString benchmarks
    const stringContent = generateJsonlString(recordCount, 42);

    // --- InputStream.fromFile (full pipeline with Record parsing) ---
    suite.add(
      `InputStream.fromFile — ${sizeLabel} lines`,
      async () => {
        const stream = InputStream.fromFile(filePath);
        const records = await stream.toArray();
        if (records.length === 0) throw new Error("No records read");
      },
      { iterations, recordCount, byteCount },
    );

    // --- InputStream.fromString (pre-loaded string, Record parsing) ---
    suite.add(
      `InputStream.fromString — ${sizeLabel} lines`,
      async () => {
        const stream = InputStream.fromString(stringContent);
        const records = await stream.toArray();
        if (records.length === 0) throw new Error("No records read");
      },
      { iterations, recordCount, byteCount },
    );

    // --- Manual buffer (isolated, no parsing) ---
    suite.add(
      `manual buffer (isolated) — ${sizeLabel} lines`,
      async () => {
        const count = await readLinesManualBuffer(filePath);
        if (count === 0) throw new Error("No lines read");
      },
      { iterations, recordCount, byteCount },
    );

    // --- Bulk text + split (no parsing) ---
    suite.add(
      `bulk text + split — ${sizeLabel} lines`,
      async () => {
        const count = await readLinesBulkSplit(filePath);
        if (count === 0) throw new Error("No lines read");
      },
      { iterations, recordCount, byteCount },
    );

    // --- Node readline (no parsing) ---
    suite.add(
      `node readline — ${sizeLabel} lines`,
      async () => {
        const count = await readLinesNodeReadline(filePath);
        if (count === 0) throw new Error("No lines read");
      },
      { iterations, recordCount, byteCount },
    );

    // --- TextDecoderStream (no parsing) ---
    suite.add(
      `TextDecoderStream — ${sizeLabel} lines`,
      async () => {
        const count = await readLinesTextDecoderStream(filePath);
        if (count === 0) throw new Error("No lines read");
      },
      { iterations, recordCount, byteCount },
    );

    // --- Binary newline scan (no parsing) ---
    suite.add(
      `binary newline scan — ${sizeLabel} lines`,
      async () => {
        const count = await readLinesBinaryScan(filePath);
        if (count === 0) throw new Error("No lines read");
      },
      { iterations, recordCount, byteCount },
    );

    // --- Bun native stdin via subprocess (no parsing) ---
    suite.add(
      `bun native stdin — ${sizeLabel} lines`,
      async () => {
        const count = await readLinesBunNativeStdin(filePath);
        if (count === 0) throw new Error("No lines read");
      },
      { iterations, recordCount, byteCount },
    );
  }

  return suite;
}
