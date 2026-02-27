import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey } from "../../KeySpec.ts";

/**
 * Create a graph of points from a record stream using GNU Plot.
 * Defaults to creating a scatterplot of points, can also create bar or line graphs.
 *
 * Analogous to App::RecordStream::Operation::tognuplot in Perl.
 */
export class ToGnuplot extends Operation {
  barGraph = false;
  dumpToScreen = false;
  gnuplotCommand = "gnuplot";
  lines = false;
  pngFile = "tognuplot.png";
  title = "";
  labels: string[] = [];
  plots: string[] = [];
  precommands: string[] = [];
  using: string[] = [];
  keyGroups = new KeyGroups();
  fields: string[] = [];
  firstRecord = true;
  dataLines: string[] = [];

  constructor(next?: RecordReceiver) {
    super(next);
  }

  override addHelpTypes(): void {
    this.useHelpType("keyspecs");
    this.useHelpType("keygroups");
    this.useHelpType("keys");
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "file",
        type: "string",
        handler: (v) => { this.pngFile = v as string; },
        description: "Name of output png file",
      },
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Keys to graph",
      },
      {
        long: "fields",
        short: "f",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Keys to graph",
      },
      {
        long: "label",
        type: "string",
        handler: (v) => { this.labels.push(...(v as string).split(",")); },
        description: "Labels for each --using line",
      },
      {
        long: "plot",
        type: "string",
        handler: (v) => { this.plots.push(...(v as string).split(",")); },
        description: "A directive passed directly to plot",
      },
      {
        long: "precommand",
        type: "string",
        handler: (v) => { this.precommands.push(...(v as string).split(",")); },
        description: "A command executed before plot",
      },
      {
        long: "title",
        type: "string",
        handler: (v) => { this.title = v as string; },
        description: "Title for the graph",
      },
      {
        long: "using",
        type: "string",
        handler: (v) => { this.using.push(v as string); },
        description: "A 'using' string passed to gnuplot",
      },
      {
        long: "bargraph",
        type: "boolean",
        handler: () => { this.barGraph = true; },
        description: "Draw a bar graph",
      },
      {
        long: "dump-to-screen",
        type: "boolean",
        handler: () => { this.dumpToScreen = true; },
        description: "Dump gnuplot script to STDOUT instead of making a graph",
      },
      {
        long: "gnuplot-command",
        type: "string",
        handler: (v) => { this.gnuplotCommand = v as string; },
        description: "Location of gnuplot binary",
      },
      {
        long: "lines",
        type: "boolean",
        handler: () => { this.lines = true; },
        description: "Draw lines between points",
      },
    ];

    this.parseOptions(args, defs);

    if (!this.keyGroups.hasAnyGroup()) {
      throw new Error("Must specify at least one field");
    }

    if (this.barGraph && this.lines) {
      throw new Error("Must specify one of --bargraph or --lines");
    }

    if (!this.pngFile.endsWith(".png")) {
      this.pngFile += ".png";
    }
  }

  initFields(record: Record): void {
    const data = record.dataRef();
    const specs = this.keyGroups.getKeyspecs(data);

    if (!this.barGraph && !this.lines) {
      if (specs.length > 2 && this.using.length === 0) {
        throw new Error("Must specify using if more than 2 fields");
      }
    }

    if (!this.title) {
      this.title = specs.join(", ");
    }

    if (this.using.length === 0) {
      if (this.barGraph || this.lines) {
        let useSpec = `1 title "${specs[0]}"`;
        for (let idx = 2; idx <= specs.length; idx++) {
          const fieldTitle = specs[idx - 1];
          useSpec += `, '' using ${idx} title "${fieldTitle}"`;
        }
        this.using.push(useSpec);
      } else if (specs.length === 1) {
        this.using.push("1");
      } else if (specs.length === 2) {
        this.using.push("1:2");
      }
    }

    this.fields = specs;
  }

  acceptRecord(record: Record): boolean {
    if (this.firstRecord) {
      this.firstRecord = false;
      this.initFields(record);
    }

    const data = record.dataRef();
    const parts: string[] = [];
    for (const key of this.fields) {
      const value = findKey(data, key, true);
      parts.push(value !== undefined && value !== null ? String(value) : "0");
    }

    const line = parts.join(" ");

    if (this.dumpToScreen) {
      this.pushLine(line);
    }
    this.dataLines.push(line);

    return true;
  }

  override streamDone(): void {
    let plotScript = "";
    plotScript += "set terminal png\n";
    plotScript += `set output '${this.pngFile}'\n`;
    plotScript += `set title '${this.title}'\n`;

    if (this.barGraph) {
      plotScript += "set style data histogram\n";
      plotScript += "set style histogram cluster gap 1\n";
      plotScript += "set style fill solid border -1\n";
    } else if (this.lines) {
      plotScript += "set style data linespoints\n";
    }

    for (const command of this.precommands) {
      plotScript += command + "\n";
    }

    let plotCmd = "plot ";
    const defaultLabel = this.fields.join(", ");

    for (let index = 0; index < this.using.length; index++) {
      const useSpec = this.using[index]!;

      if (this.dumpToScreen) {
        plotCmd += `'screen' using ${useSpec} `;
      } else {
        plotCmd += `'DATAFILE' using ${useSpec} `;
      }

      if (!useSpec.includes("title")) {
        const label = this.labels[index] ?? defaultLabel;
        plotCmd += `title '${label}'`;
      }

      plotCmd += ", ";
    }

    // Remove trailing ", "
    plotCmd = plotCmd.slice(0, -2);

    if (this.plots.length > 0) {
      plotCmd += ", " + this.plots.join(", ");
    }

    plotScript += plotCmd;

    if (this.dumpToScreen) {
      this.pushLine(plotScript);
    } else {
      // Write data to temp file and run gnuplot
      this.runGnuplot(plotScript);
    }
  }

  runGnuplot(plotScript: string): void {
    // In actual runtime, we'd write to a temp file and pipe to gnuplot
    // For now, we write the data and script
    try {
      const tmpDir = Bun.env["TMPDIR"] ?? "/tmp";
      const tmpFile = `${tmpDir}/recs-gnuplot-${Date.now()}.dat`;

      // Write data file
      Bun.write(tmpFile, this.dataLines.join("\n") + "\n");

      // Replace DATAFILE placeholder
      const script = plotScript.replace(/DATAFILE/g, tmpFile);

      // Run gnuplot
      const proc = Bun.spawnSync([this.gnuplotCommand], {
        stdin: new TextEncoder().encode(script),
      });

      if (proc.exitCode !== 0) {
        const stderr = new TextDecoder().decode(proc.stderr);
        console.error("Gnuplot failed:", stderr);
        this.setExitValue(proc.exitCode);
        return;
      }

      this.pushLine("Wrote graph file: " + this.pngFile);

      // Cleanup temp file
      try { Bun.write(tmpFile, ""); } catch { /* ignore cleanup errors */ }
    } catch (e) {
      console.error("Could not run gnuplot:", e);
    }
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs tognuplot <args> [<files>]
   Create a graph of points from a record stream using GNU Plot.

Arguments:
  --key|-k <keys>        Keys to graph
  --using <spec>         A 'using' string passed directly to gnuplot
  --plot <spec>          A directive passed directly to plot
  --precommand <spec>    A command executed before plot
  --title <title>        Title for the graph
  --label <label>        Labels each --using line
  --file <filename>      Output png file name (default tognuplot.png)
  --lines                Draw lines between points
  --bargraph             Draw a bar graph
  --gnuplot-command      Location of gnuplot binary
  --dump-to-screen       Dump gnuplot script to STDOUT

Examples:
   Graph the count field
      recs tognuplot --field count
   Graph count vs. date with a threshold line
      recs tognuplot --field count,date --plot "5 title 'threshold'"`;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "tognuplot",
  category: "output",
  synopsis: "recs tognuplot [options] [files...]",
  description:
    "Create a graph of points from a record stream using GNU Plot. Defaults to creating a scatterplot of points, can also create a bar or line graph.",
  options: [
    {
      flags: ["--key", "-k", "--fields", "-f"],
      argument: "<keys>",
      description:
        "Keys to graph. May be specified multiple times or comma separated. If you have more than 2 keys, you must specify a --using statement or use --bargraph or --lines.",
      required: true,
    },
    {
      flags: ["--using"],
      argument: "<using spec>",
      description:
        "A 'using' string passed directly to gnuplot. You can reference keys specified with --key in the order specified. May be specified multiple times.",
    },
    {
      flags: ["--plot"],
      argument: "<plot spec>",
      description:
        "A directive passed directly to plot, e.g. --plot '5 title \"threshold\"'. May be specified multiple times or comma separated.",
    },
    {
      flags: ["--precommand"],
      argument: "<gnuplot spec>",
      description:
        "A command executed by gnuplot before executing plot, e.g. --precommand 'set xlabel \"foo\"'. May be specified multiple times or comma separated.",
    },
    {
      flags: ["--title"],
      argument: "<title>",
      description: "Specify a title for the entire graph.",
    },
    {
      flags: ["--label"],
      argument: "<label>",
      description: "Labels each --using line with the indicated label.",
    },
    {
      flags: ["--file"],
      argument: "<filename>",
      description:
        "Name of output png file. Will append .png if not present. Defaults to tognuplot.png.",
    },
    {
      flags: ["--lines"],
      description:
        "Draw lines between points. May specify more than 2 keys, each field is a line.",
    },
    {
      flags: ["--bargraph"],
      description:
        "Draw a bar graph. May specify more than 2 keys, each field is a bar.",
    },
    {
      flags: ["--gnuplot-command"],
      argument: "<path>",
      description: "Location of gnuplot binary if not on path.",
    },
    {
      flags: ["--dump-to-screen"],
      description:
        "Instead of making a graph, dump the generated gnuplot script to STDOUT.",
    },
  ],
  examples: [
    {
      description: "Graph the count field",
      command: "recs tognuplot --field count",
    },
    {
      description: "Graph count vs. date with a threshold line",
      command: "recs tognuplot --field count,date --plot \"5 title 'threshold'\"",
    },
    {
      description: "Graph a complicated expression, with a label",
      command:
        "recs tognuplot --field count,date,adjust --using '($1-$3):2' --label counts",
    },
    {
      description: "Graph count vs. date, with a title",
      command: "recs tognuplot --field count,date --title 'counts over time'",
    },
  ],
  seeAlso: ["togdgraph"],
};
