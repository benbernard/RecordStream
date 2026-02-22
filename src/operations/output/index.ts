export { ToCsv } from "./tocsv.ts";
export { ToJsonArray } from "./tojsonarray.ts";
export { ToPrettyPrint } from "./toprettyprint.ts";
export { ToTable } from "./totable.ts";
export { ToPtable } from "./toptable.ts";
export { ToHtml } from "./tohtml.ts";
export { ToGnuplot } from "./tognuplot.ts";
export { ToGdGraph } from "./togdgraph.ts";
export { ToDb } from "./todb.ts";

import type { Operation, RecordReceiver } from "../../Operation.ts";
import { ToCsv } from "./tocsv.ts";
import { ToJsonArray } from "./tojsonarray.ts";
import { ToPrettyPrint } from "./toprettyprint.ts";
import { ToTable } from "./totable.ts";
import { ToPtable } from "./toptable.ts";
import { ToHtml } from "./tohtml.ts";
import { ToGnuplot } from "./tognuplot.ts";
import { ToGdGraph } from "./togdgraph.ts";
import { ToDb } from "./todb.ts";

type OpConstructor = new (next?: RecordReceiver) => Operation;

/**
 * Registry of all output operations, keyed by CLI name.
 */
export const outputOperations = new Map<string, OpConstructor>();
outputOperations.set("tocsv", ToCsv);
outputOperations.set("tojsonarray", ToJsonArray);
outputOperations.set("toprettyprint", ToPrettyPrint);
outputOperations.set("totable", ToTable);
outputOperations.set("toptable", ToPtable);
outputOperations.set("tohtml", ToHtml);
outputOperations.set("tognuplot", ToGnuplot);
outputOperations.set("togdgraph", ToGdGraph);
outputOperations.set("todb", ToDb);
