/**
 * CLI dispatcher: looks up operations by name, wires I/O, and runs the pipeline.
 */

import { Operation, HelpExit, PrinterReceiver } from "../Operation.ts";
import type { RecordReceiver } from "../Operation.ts";
import { Record } from "../Record.ts";
import { loadDocForCommand, docToHelpText } from "./help.ts";

// -- Input operations --
import { FromApache } from "../operations/input/fromapache.ts";
import { FromAtomFeed } from "../operations/input/fromatomfeed.ts";
import { FromCsv } from "../operations/input/fromcsv.ts";
import { FromDb } from "../operations/input/fromdb.ts";
import { FromJsonArray } from "../operations/input/fromjsonarray.ts";
import { FromKv } from "../operations/input/fromkv.ts";
import { FromMongo } from "../operations/input/frommongo.ts";
import { FromMultiRe } from "../operations/input/frommultire.ts";
import { FromPs } from "../operations/input/fromps.ts";
import { FromRe } from "../operations/input/fromre.ts";
import { FromSplit } from "../operations/input/fromsplit.ts";
import { FromTcpdump } from "../operations/input/fromtcpdump.ts";
import { FromXferlog } from "../operations/input/fromxferlog.ts";
import { FromXls } from "../operations/input/fromxls.ts";
import { FromXml } from "../operations/input/fromxml.ts";

// -- Transform operations --
import { GrepOperation } from "../operations/transform/grep.ts";
import { EvalOperation } from "../operations/transform/eval.ts";
import { XformOperation } from "../operations/transform/xform.ts";
import { SortOperation } from "../operations/transform/sort.ts";
import { TopnOperation } from "../operations/transform/topn.ts";
import { AssertOperation } from "../operations/transform/assert.ts";
import { DeltaOperation } from "../operations/transform/delta.ts";
import { FlattenOperation } from "../operations/transform/flatten.ts";
import { AnnotateOperation } from "../operations/transform/annotate.ts";
import { GenerateOperation } from "../operations/transform/generate.ts";
import { NormalizeTimeOperation } from "../operations/transform/normalizetime.ts";
import { Stream2TableOperation } from "../operations/transform/stream2table.ts";
import { SubstreamOperation } from "../operations/transform/substream.ts";
import { JoinOperation } from "../operations/transform/join.ts";
import { CollateOperation } from "../operations/transform/collate.ts";
import { DecollateOperation } from "../operations/transform/decollate.ts";
import { ExpandJsonOperation } from "../operations/transform/expandjson.ts";
import { ParseDateOperation } from "../operations/transform/parsedate.ts";
import { ChainOperation, registerOperationFactory } from "../operations/transform/chain.ts";
import { MultiplexOperation } from "../operations/transform/multiplex.ts";

// -- Output operations --
import { ToCsv } from "../operations/output/tocsv.ts";
import { ToJsonArray } from "../operations/output/tojsonarray.ts";
import { ToPrettyPrint } from "../operations/output/toprettyprint.ts";
import { ToTable } from "../operations/output/totable.ts";
import { ToPtable } from "../operations/output/toptable.ts";
import { ToHtml } from "../operations/output/tohtml.ts";
import { ToGnuplot } from "../operations/output/tognuplot.ts";
import { ToGdGraph } from "../operations/output/togdgraph.ts";
import { ToDb } from "../operations/output/todb.ts";
import { ToChart } from "../operations/output/tochart.ts";

type OpConstructor = new (next?: RecordReceiver) => Operation;

/**
 * Registry mapping CLI command names to operation constructors.
 */
const operationRegistry = new Map<string, OpConstructor>([
  // Input
  ["fromapache", FromApache],
  ["fromatomfeed", FromAtomFeed],
  ["fromcsv", FromCsv],
  ["fromdb", FromDb],
  ["fromjsonarray", FromJsonArray],
  ["fromkv", FromKv],
  ["frommongo", FromMongo],
  ["frommultire", FromMultiRe],
  ["fromps", FromPs],
  ["fromre", FromRe],
  ["fromsplit", FromSplit],
  ["fromtcpdump", FromTcpdump],
  ["fromxferlog", FromXferlog],
  ["fromxls", FromXls],
  ["fromxml", FromXml],
  // Transform
  ["grep", GrepOperation],
  ["eval", EvalOperation],
  ["xform", XformOperation],
  ["sort", SortOperation],
  ["topn", TopnOperation],
  ["assert", AssertOperation],
  ["delta", DeltaOperation],
  ["expandjson", ExpandJsonOperation],
  ["flatten", FlattenOperation],
  ["annotate", AnnotateOperation],
  ["generate", GenerateOperation],
  ["normalizetime", NormalizeTimeOperation],
  ["stream2table", Stream2TableOperation],
  ["substream", SubstreamOperation],
  ["join", JoinOperation],
  ["collate", CollateOperation],
  ["decollate", DecollateOperation],
  ["parsedate", ParseDateOperation],
  ["chain", ChainOperation],
  ["multiplex", MultiplexOperation],
  // Output
  ["tocsv", ToCsv],
  ["tojsonarray", ToJsonArray],
  ["toprettyprint", ToPrettyPrint],
  ["totable", ToTable],
  ["toptable", ToPtable],
  ["tohtml", ToHtml],
  ["tognuplot", ToGnuplot],
  ["togdgraph", ToGdGraph],
  ["todb", ToDb],
  ["tochart", ToChart],
]);

// Register all built-in operations with the chain factory so that
// ChainOperation can instantiate them by name (not just plugins).
for (const [name, Ctor] of operationRegistry) {
  if (name !== "chain") {
    registerOperationFactory(name, (next: RecordReceiver) => new Ctor(next));
  }
}

/**
 * Input operations that consume bulk content via parseContent()/parseXml().
 * For these ops, when no file args are given we read all of stdin as one string.
 * When file args are given, the dispatcher reads each file and calls parseContent().
 */
const BULK_CONTENT_OPS = new Set(["fromcsv", "fromjsonarray", "fromxml"]);

/**
 * Read all of stdin as a string.
 */
async function readAllStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = Bun.stdin.stream().getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const decoder = new TextDecoder();
  return chunks.map((c) => decoder.decode(c, { stream: true })).join("") +
    decoder.decode();
}

/**
 * Read stdin line by line, calling callback for each non-empty line.
 */
async function readStdinLines(callback: (line: string) => boolean): Promise<void> {
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIdx = buffer.indexOf("\n");
    while (newlineIdx >= 0) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (line !== "") {
        if (!callback(line)) return;
      }
      newlineIdx = buffer.indexOf("\n");
    }
  }

  // Handle remaining content
  buffer += decoder.decode();
  const remaining = buffer.trim();
  if (remaining !== "") {
    callback(remaining);
  }
}

/**
 * Read a file synchronously and return its content.
 */
function readFileSync(path: string): string {
  const fs = require("node:fs") as typeof import("node:fs");
  return fs.readFileSync(path, "utf-8");
}

/**
 * Read a file line by line, calling callback for each non-empty line.
 * Returns false if the callback signalled stop.
 */
function feedFileLines(path: string, callback: (line: string) => boolean): void {
  const content = readFileSync(path);
  for (const line of content.split("\n")) {
    if (line === "") continue;
    if (!callback(line)) return;
  }
}

/**
 * Look up an operation constructor by name.
 */
export function lookupOperation(name: string): OpConstructor | undefined {
  return operationRegistry.get(name);
}

/**
 * Get all registered operation names.
 */
export function listOperations(): string[] {
  return [...operationRegistry.keys()].sort();
}

/**
 * Run an operation from the CLI.
 *
 * @param command - The operation name (e.g. "grep", "fromcsv")
 * @param args - The remaining CLI arguments after the command name
 * @returns exit code
 */
export async function runOperation(command: string, args: string[]): Promise<number> {
  const Ctor = lookupOperation(command);
  if (!Ctor) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.stderr.write("Run 'recs help' for a list of commands.\n");
    return 1;
  }

  const receiver = new PrinterReceiver();
  const op = new Ctor(receiver);

  try {
    op.init(args);
  } catch (e) {
    if (e instanceof HelpExit) {
      console.log(e.message);
      return 0;
    }
    // If --help was parsed before init() threw (e.g. missing required args),
    // still show help instead of the error.
    if (op.getWantsHelp()) {
      console.log(buildHelpOutput(command, op));
      return 0;
    }
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }

  if (op.getWantsHelp()) {
    console.log(buildHelpOutput(command, op));
    return 0;
  }

  try {
    await feedOperation(command, op);
  } catch (e) {
    if (e instanceof HelpExit) {
      console.log(e.message);
      return 0;
    }
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }

  return op.getExitValue();
}

/**
 * Build the help output for a command.
 * Uses the CommandDoc system if available, falling back to op.usage().
 * Appends a "Help Options:" section listing available --help-* flags.
 */
function buildHelpOutput(command: string, op: Operation): string {
  const doc = loadDocForCommand(command);
  const baseHelp = doc ? docToHelpText(doc) : op.usage();

  const helpOptions = getHelpOptionsSection(op);
  if (helpOptions) {
    return baseHelp + "\n" + helpOptions;
  }
  return baseHelp;
}

/**
 * Build a "Help Options:" section from the operation's registered help types.
 * Only includes help types that are enabled (use: true) and not the basic --help.
 */
function getHelpOptionsSection(op: Operation): string | null {
  const entries: Array<{ flag: string; description: string }> = [];

  for (const [type, info] of op.helpTypes) {
    if (!info.use) continue;
    const optName = info.optionName ?? `help-${type}`;
    entries.push({ flag: `--${optName}`, description: info.description });
  }

  if (entries.length === 0) return null;

  const maxFlag = Math.max(...entries.map((e) => e.flag.length));
  const lines: string[] = ["Help Options:"];
  for (const { flag, description } of entries) {
    lines.push(`  ${flag.padEnd(maxFlag + 2)}${description}`);
  }

  return lines.join("\n") + "\n";
}

/**
 * Feed input to the operation and finish it.
 *
 * The dispatcher transparently handles both stdin and file arguments so that
 * individual operations don't need to implement their own file-reading logic.
 *
 * Strategy:
 * 1. If the op has file args (extraArgs) AND is a type the dispatcher feeds:
 *    - Bulk content ops: read each file, call parseContent()/parseXml()
 *    - Line-oriented ops (custom acceptLine): read each file line by line
 *    - Record-oriented ops (transforms): read files as JSON lines
 * 2. If no file args, fall back to stdin:
 *    - Line-oriented: feed stdin lines via acceptLine()
 *    - Record-oriented: feed stdin lines as JSON records
 *    - Bulk content: read all stdin, call parseContent()/parseXml()
 * 3. Self-contained ops (fromps, fromdb, fromtcpdump, etc.): just finish
 */
async function feedOperation(command: string, op: Operation): Promise<void> {
  const fileArgs = getFileArgs(op);
  const isBulk = BULK_CONTENT_OPS.has(command);
  const isLineOriented = !isBulk && hasCustomAcceptLine(op);

  if (fileArgs.length > 0 && (op.wantsInput() || isBulk)) {
    // --- Feed from files ---
    if (isBulk) {
      for (const file of fileArgs) {
        op.updateCurrentFilename(file);
        const content = readFileSync(file);
        callParseContent(command, op, content);
      }
    } else if (isLineOriented) {
      for (const file of fileArgs) {
        op.updateCurrentFilename(file);
        feedFileLines(file, (line) => op.acceptLine(line));
      }
    } else {
      // Record-oriented (transform ops)
      for (const file of fileArgs) {
        op.updateCurrentFilename(file);
        feedFileLines(file, (line) => {
          try {
            const record = Record.fromJSON(line);
            return op.acceptRecord(record);
          } catch {
            return true;
          }
        });
      }
    }
    await op.finish();
  } else if (op.wantsInput()) {
    // --- Feed from stdin (line or record oriented) ---
    if (isLineOriented) {
      await readStdinLines((line) => op.acceptLine(line));
    } else {
      await readStdinLines((line) => {
        try {
          const record = Record.fromJSON(line);
          return op.acceptRecord(record);
        } catch {
          return true;
        }
      });
    }
    await op.finish();
  } else if (isBulk && needsStdinContent(op)) {
    // --- Bulk stdin (fromcsv, fromjsonarray, fromxml with no args) ---
    const content = await readAllStdin();
    if (content.trim()) {
      callParseContent(command, op, content);
    }
    await op.finish();
  } else {
    // --- Self-contained (fromps, fromdb, fromtcpdump, fromxls, etc.) ---
    await op.finish();
  }
}

/**
 * Get file args from an operation's extraArgs property.
 */
function getFileArgs(op: Operation): string[] {
  const opRecord = op as unknown as { [key: string]: unknown };
  const extraArgs = opRecord["extraArgs"];
  if (Array.isArray(extraArgs)) {
    return extraArgs as string[];
  }
  return [];
}

/**
 * Check if the operation has a custom acceptLine implementation
 * (indicating it processes raw text lines, not JSON records).
 */
function hasCustomAcceptLine(op: Operation): boolean {
  const proto = Object.getPrototypeOf(op) as { [key: string]: unknown };
  return typeof proto["acceptLine"] === "function" &&
    proto["acceptLine"] !== Operation.prototype.acceptLine;
}

/**
 * Check if an input operation needs stdin content (has no file args or URL args).
 */
function needsStdinContent(op: Operation): boolean {
  const opRecord = op as unknown as { [key: string]: unknown };
  const extraArgs = opRecord["extraArgs"];
  if (Array.isArray(extraArgs) && extraArgs.length > 0) return false;
  // fromxml stores URL args separately; if it has URLs it doesn't need stdin
  const urlArgs = opRecord["urlArgs"];
  if (Array.isArray(urlArgs) && urlArgs.length > 0) return false;
  return true;
}

/**
 * Call the appropriate content parsing method on an input operation.
 */
function callParseContent(command: string, op: Operation, content: string): void {
  const opAny = op as unknown as { [key: string]: unknown };
  if (command === "fromxml" && typeof opAny["parseXml"] === "function") {
    (opAny["parseXml"] as (xml: string) => void)(content);
  } else if (typeof opAny["parseContent"] === "function") {
    (opAny["parseContent"] as (content: string) => void)(content);
  }
}
