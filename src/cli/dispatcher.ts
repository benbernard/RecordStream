/**
 * CLI dispatcher: looks up operations by name, wires I/O, and runs the pipeline.
 */

import { Operation, HelpExit, PrinterReceiver } from "../Operation.ts";
import type { RecordReceiver } from "../Operation.ts";
import { Record } from "../Record.ts";

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
 * Input operations that can consume bulk stdin content via parseContent().
 * When they have no file args, we read all of stdin and call parseContent().
 */
const BULK_STDIN_OPS = new Set(["fromcsv", "fromjsonarray", "fromkv", "fromxml"]);

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
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }

  if (op.getWantsHelp()) {
    console.log(op.usage());
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
 * Feed input to the operation and finish it.
 *
 * The feeding strategy depends on the operation type:
 * - Operations that wantsInput() and have acceptLine: feed raw lines
 *   (used by input ops like fromre, fromapache that parse raw text)
 * - Operations that wantsInput() and are transforms: feed JSON records
 * - Input operations that don't want input but accept bulk content:
 *   read all stdin and call parseContent()
 * - Operations that don't want input at all (fromps, fromdb): just finish
 */
async function feedOperation(command: string, op: Operation): Promise<void> {
  if (op.wantsInput()) {
    // Determine if this is a line-oriented input op (has custom acceptLine)
    // or a record-oriented transform op
    const isLineOriented = hasCustomAcceptLine(op);

    if (isLineOriented) {
      // Feed raw lines from stdin — used by fromre, fromsplit, fromapache, etc.
      await readStdinLines((line) => {
        if (op.acceptLine) {
          return op.acceptLine(line);
        }
        return true;
      });
    } else {
      // Feed JSON records from stdin or file args
      // Parse remaining args (after options) to find file paths
      // Since init() already consumed options, we check if the operation
      // has stashed extra args that look like file paths.
      await readStdinLines((line) => {
        try {
          const record = Record.fromJSON(line);
          return op.acceptRecord(record);
        } catch {
          // If it's not JSON, skip it
          return true;
        }
      });
    }
    op.finish();
  } else if (BULK_STDIN_OPS.has(command) && needsStdinContent(op)) {
    // Input op that needs bulk stdin content (no file args given)
    const content = await readAllStdin();
    if (content.trim()) {
      callParseContent(command, op, content);
    }
    op.finish();
  } else {
    // Self-contained operation (fromps, fromdb, etc.) or has file args
    op.finish();
  }
}

/**
 * Check if the operation has a custom acceptLine implementation
 * (indicating it processes raw text lines, not JSON records).
 */
function hasCustomAcceptLine(op: Operation): boolean {
  // Check if the prototype overrides acceptLine
  const proto = Object.getPrototypeOf(op) as { [key: string]: unknown };
  return typeof proto["acceptLine"] === "function" &&
    proto["acceptLine"] !== Operation.prototype.acceptLine;
}

/**
 * Check if an input operation needs stdin content (has no file args to process).
 * We detect this by checking the extraArgs property which input ops use for files.
 */
function needsStdinContent(op: Operation): boolean {
  // Input ops store file args in extraArgs; if empty, they need stdin
  const opRecord = op as unknown as { [key: string]: unknown };
  const extraArgs = opRecord["extraArgs"];
  if (Array.isArray(extraArgs)) {
    return extraArgs.length === 0;
  }
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
