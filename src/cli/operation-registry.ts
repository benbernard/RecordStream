/**
 * Static registry of all operation documentation.
 *
 * This file imports every operation's CommandDoc at build time so the help
 * system works in compiled binaries (where runtime filesystem scanning is
 * not available).
 */

import type { CommandDoc } from "../types/CommandDoc.ts";

// ── Input operations ────────────────────────────────────────────
import { documentation as fromapache } from "../operations/input/fromapache.ts";
import { documentation as fromatomfeed } from "../operations/input/fromatomfeed.ts";
import { documentation as fromcsv } from "../operations/input/fromcsv.ts";
import { documentation as fromdb } from "../operations/input/fromdb.ts";
import { documentation as fromjsonarray } from "../operations/input/fromjsonarray.ts";
import { documentation as fromkv } from "../operations/input/fromkv.ts";
import { documentation as frommongo } from "../operations/input/frommongo.ts";
import { documentation as frommultire } from "../operations/input/frommultire.ts";
import { documentation as fromps } from "../operations/input/fromps.ts";
import { documentation as fromre } from "../operations/input/fromre.ts";
import { documentation as fromsplit } from "../operations/input/fromsplit.ts";
import { documentation as fromtcpdump } from "../operations/input/fromtcpdump.ts";
import { documentation as fromxferlog } from "../operations/input/fromxferlog.ts";
import { documentation as fromxml } from "../operations/input/fromxml.ts";

// ── Transform operations ────────────────────────────────────────
import { documentation as annotate } from "../operations/transform/annotate.ts";
import { documentation as assert_ } from "../operations/transform/assert.ts";
import { documentation as chain } from "../operations/transform/chain.ts";
import { documentation as collate } from "../operations/transform/collate.ts";
import { documentation as decollate } from "../operations/transform/decollate.ts";
import { documentation as delta } from "../operations/transform/delta.ts";
import { documentation as eval_ } from "../operations/transform/eval.ts";
import { documentation as expandjson } from "../operations/transform/expandjson.ts";
import { documentation as flatten } from "../operations/transform/flatten.ts";
import { documentation as generate } from "../operations/transform/generate.ts";
import { documentation as grep } from "../operations/transform/grep.ts";
import { documentation as join } from "../operations/transform/join.ts";
import { documentation as multiplex } from "../operations/transform/multiplex.ts";
import { documentation as normalizetime } from "../operations/transform/normalizetime.ts";
import { documentation as sort } from "../operations/transform/sort.ts";
import { documentation as stream2table } from "../operations/transform/stream2table.ts";
import { documentation as substream } from "../operations/transform/substream.ts";
import { documentation as topn } from "../operations/transform/topn.ts";
import { documentation as xform } from "../operations/transform/xform.ts";

// ── Output operations ───────────────────────────────────────────
import { documentation as tocsv } from "../operations/output/tocsv.ts";
import { documentation as todb } from "../operations/output/todb.ts";
import { documentation as togdgraph } from "../operations/output/togdgraph.ts";
import { documentation as tognuplot } from "../operations/output/tognuplot.ts";
import { documentation as tohtml } from "../operations/output/tohtml.ts";
import { documentation as tojsonarray } from "../operations/output/tojsonarray.ts";
import { documentation as toprettyprint } from "../operations/output/toprettyprint.ts";
import { documentation as toptable } from "../operations/output/toptable.ts";
import { documentation as totable } from "../operations/output/totable.ts";

export const allDocs: CommandDoc[] = [
  // Input
  fromapache,
  fromatomfeed,
  fromcsv,
  fromdb,
  fromjsonarray,
  fromkv,
  frommongo,
  frommultire,
  fromps,
  fromre,
  fromsplit,
  fromtcpdump,
  fromxferlog,
  fromxml,
  // Transform
  annotate,
  assert_,
  chain,
  collate,
  decollate,
  delta,
  eval_,
  expandjson,
  flatten,
  generate,
  grep,
  join,
  multiplex,
  normalizetime,
  sort,
  stream2table,
  substream,
  topn,
  xform,
  // Output
  tocsv,
  todb,
  togdgraph,
  tognuplot,
  tohtml,
  tojsonarray,
  toprettyprint,
  toptable,
  totable,
];
