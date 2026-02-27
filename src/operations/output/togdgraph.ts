import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import type { JsonValue, JsonArray } from "../../types/json.ts";

const GD_TYPES: { [key: string]: string } = {
  line: "lines",
  scatter: "points",
  bar: "bars",
};

/**
 * Create a bar, scatter, or line graph.
 * The Perl version uses GD::Graph; this TS version generates SVG output
 * or uses a dump-use-spec mode for testing.
 *
 * Analogous to App::RecordStream::Operation::togdgraph in Perl.
 */
export class ToGdGraph extends Operation {
  pngFile = "togdgraph.png";
  title = "";
  labelX = "";
  labelY = "";
  additionalOptions: [string, string][] = [];
  graphType = "scatter";
  width = 600;
  height = 300;
  dumpUseSpec = false;
  keyGroups = new KeyGroups();
  fields: string[] = [];
  firstRecord = true;
  plotData: Map<string, JsonArray> = new Map();

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
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Specify keys that correlate to keys in JSON data",
      },
      {
        long: "fields",
        short: "f",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Specify keys that correlate to keys in JSON data",
      },
      {
        long: "option",
        short: "o",
        type: "string",
        handler: (v) => {
          const parts = (v as string).split("=");
          if (parts.length >= 2) {
            this.additionalOptions.push([parts[0]!, parts.slice(1).join("=")]);
          }
        },
        description: "Specify custom options for the graph",
      },
      {
        long: "label-x",
        type: "string",
        handler: (v) => { this.labelX = v as string; },
        description: "Specify X-axis label",
      },
      {
        long: "label-y",
        type: "string",
        handler: (v) => { this.labelY = v as string; },
        description: "Specify Y-axis label",
      },
      {
        long: "graph-title",
        type: "string",
        handler: (v) => { this.title = v as string; },
        description: "Specify graph title",
      },
      {
        long: "png-file",
        type: "string",
        handler: (v) => { this.pngFile = v as string; },
        description: "Specify output PNG filename",
      },
      {
        long: "type",
        type: "string",
        handler: (v) => { this.graphType = v as string; },
        description: "Specify graph type (scatter, line, bar)",
      },
      {
        long: "width",
        type: "string",
        handler: (v) => { this.width = parseInt(v as string, 10); },
        description: "Specify width",
      },
      {
        long: "height",
        type: "string",
        handler: (v) => { this.height = parseInt(v as string, 10); },
        description: "Specify height",
      },
      {
        long: "dump-use-spec",
        type: "boolean",
        handler: () => { this.dumpUseSpec = true; },
        description: "Dump usage spec (used mainly for testing)",
      },
    ];

    this.parseOptions(args, defs);

    if (!GD_TYPES[this.graphType]) {
      throw new Error(`Unsupported graph type: ${this.graphType}`);
    }

    if (this.dumpUseSpec) {
      if (this.labelX) this.pushLine("x label: " + this.labelX);
      if (this.labelY) this.pushLine("y label: " + this.labelY);
      if (this.title) this.pushLine("title: " + this.title);
      this.pushLine("type: " + this.graphType);
      this.pushLine("width: " + this.width);
      this.pushLine("height: " + this.height);
      this.pushLine("output file: " + this.pngFile);
    }
  }

  initFields(record: Record): void {
    const data = record.dataRef();
    const specs = this.keyGroups.getKeyspecs(data);

    if (this.dumpUseSpec) {
      for (const field of specs) {
        this.pushLine("field: " + field);
      }
    }

    this.fields = specs;
    for (const field of this.fields) {
      this.plotData.set(field, []);
    }
  }

  acceptRecord(record: Record): boolean {
    if (this.firstRecord) {
      this.firstRecord = false;
      this.initFields(record);
    }

    const data = record.dataRef();
    const recordSpec: string[] = [];

    for (const key of this.fields) {
      const val = data[key];
      this.plotData.get(key)!.push(val as JsonValue);
      recordSpec.push(val !== undefined && val !== null ? String(val) : "");
    }

    if (this.dumpUseSpec) {
      this.pushLine(recordSpec.join(" "));
    }

    return true;
  }

  override streamDone(): void {
    if (this.dumpUseSpec) return;

    // Generate SVG output as an alternative to GD::Graph
    const svg = this.generateSvg();

    try {
      Bun.write(this.pngFile, svg);
      this.pushLine("Wrote graph file: " + this.pngFile);
    } catch (e) {
      console.error("Could not write graph file:", e);
    }
  }

  generateSvg(): string {
    const w = this.width;
    const h = this.height;
    const margin = 50;

    // Build data arrays
    const fieldEntries = [...this.plotData.entries()];
    if (fieldEntries.length === 0) return "<svg></svg>";

    const allValues: number[][] = [];
    for (const [, values] of fieldEntries) {
      allValues.push(values.map((v) => (typeof v === "number" ? v : parseFloat(String(v)) || 0)));
    }

    let xData: number[];
    let yDataSets: number[][];
    let legends: string[];

    if (fieldEntries.length === 1) {
      const dataLen = allValues[0]!.length;
      xData = Array.from({ length: dataLen }, (_, i) => i + 1);
      yDataSets = [allValues[0]!];
      legends = [fieldEntries[0]![0]];
    } else {
      xData = allValues[0]!;
      yDataSets = allValues.slice(1);
      legends = fieldEntries.slice(1).map(([name]) => name);
    }

    const allY = yDataSets.flat();
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const minX = Math.min(...xData);
    const maxX = Math.max(...xData);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const plotW = w - 2 * margin;
    const plotH = h - 2 * margin;

    const scaleX = (v: number) => margin + ((v - minX) / rangeX) * plotW;
    const scaleY = (v: number) => h - margin - ((v - minY) / rangeY) * plotH;

    const colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"];

    let paths = "";
    for (let s = 0; s < yDataSets.length; s++) {
      const yData = yDataSets[s]!;
      const color = colors[s % colors.length]!;

      if (this.graphType === "bar") {
        const barWidth = plotW / xData.length / (yDataSets.length + 1);
        for (let i = 0; i < yData.length; i++) {
          const x = scaleX(xData[i]!) - barWidth / 2 + s * barWidth;
          const y = scaleY(yData[i]!);
          const barH = h - margin - y;
          paths += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" />\n`;
        }
      } else if (this.graphType === "line") {
        let d = "";
        for (let i = 0; i < yData.length; i++) {
          const x = scaleX(xData[i]!);
          const y = scaleY(yData[i]!);
          d += i === 0 ? `M${x},${y}` : ` L${x},${y}`;
        }
        paths += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" />\n`;
        for (let i = 0; i < yData.length; i++) {
          paths += `<circle cx="${scaleX(xData[i]!)}" cy="${scaleY(yData[i]!)}" r="3" fill="${color}" />\n`;
        }
      } else {
        // scatter
        for (let i = 0; i < yData.length; i++) {
          paths += `<circle cx="${scaleX(xData[i]!)}" cy="${scaleY(yData[i]!)}" r="3" fill="${color}" />\n`;
        }
      }

      // Legend
      const legendY = margin / 2 + s * 15;
      paths += `<rect x="${w - margin - 80}" y="${legendY - 5}" width="10" height="10" fill="${color}" />\n`;
      paths += `<text x="${w - margin - 65}" y="${legendY + 4}" font-size="10">${legends[s] ?? ""}</text>\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="white" />
  ${this.title ? `<text x="${w / 2}" y="20" text-anchor="middle" font-size="14">${this.title}</text>` : ""}
  ${this.labelX ? `<text x="${w / 2}" y="${h - 10}" text-anchor="middle" font-size="12">${this.labelX}</text>` : ""}
  ${this.labelY ? `<text x="15" y="${h / 2}" text-anchor="middle" font-size="12" transform="rotate(-90,15,${h / 2})">${this.labelY}</text>` : ""}
  <line x1="${margin}" y1="${margin}" x2="${margin}" y2="${h - margin}" stroke="black" />
  <line x1="${margin}" y1="${h - margin}" x2="${w - margin}" y2="${h - margin}" stroke="black" />
  ${paths}
</svg>`;
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs togdgraph <args> [<files>]
  Create a bar, scatter, or line graph.

Args:
  --key|-k <keyspec>     Specify keys for the graph
  --option|-o opt=val    Specify custom graph options
  --label-x <val>        X-axis label
  --label-y <val>        Y-axis label
  --width <val>          Graph width
  --height <val>         Graph height
  --graph-title <val>    Graph title
  --type <val>           Graph type (scatter, line, bar)
  --png-file <val>       Output filename
  --dump-use-spec        Dump usage spec (for testing)

Examples:
  recs togdgraph --keys uid,ct --png-file login-graph.png --graph-title '# of logins'
  recs togdgraph --keys uid,ct --type line`;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "togdgraph",
  category: "output",
  synopsis: "recs togdgraph [options] [files...]",
  description:
    "Create a bar, scatter, or line graph. Generates an image file from the record stream.",
  options: [
    {
      flags: ["--key", "-k", "--fields", "-f"],
      argument: "<keyspec>",
      description: "Specify keys that correlate to keys in JSON data.",
    },
    {
      flags: ["--option", "-o"],
      argument: "<option=val>",
      description: "Specify custom options for the graph.",
    },
    {
      flags: ["--label-x"],
      argument: "<val>",
      description: "Specify X-axis label.",
    },
    {
      flags: ["--label-y"],
      argument: "<val>",
      description: "Specify Y-axis label.",
    },
    {
      flags: ["--graph-title"],
      argument: "<val>",
      description: "Specify graph title.",
    },
    {
      flags: ["--png-file"],
      argument: "<val>",
      description: "Specify output PNG filename (default: togdgraph.png).",
    },
    {
      flags: ["--type"],
      argument: "<val>",
      description: "Specify graph type: scatter (default), line, or bar.",
    },
    {
      flags: ["--width"],
      argument: "<val>",
      description: "Specify graph width (default: 600).",
    },
    {
      flags: ["--height"],
      argument: "<val>",
      description: "Specify graph height (default: 300).",
    },
    {
      flags: ["--dump-use-spec"],
      description: "Dump usage spec (used mainly for testing).",
    },
  ],
  examples: [
    {
      description: "Create a scatter plot of uid vs ct",
      command:
        "recs togdgraph --key uid,ct --png-file login-graph.png --graph-title '# of logins' --label-x user --label-y logins",
    },
    {
      description: "Create a line graph",
      command: "recs togdgraph --key uid,ct --type line",
    },
    {
      description: "Customize with additional graph options",
      command:
        "recs togdgraph --key uid,ct --option boxclr=pink --label-y logins --label-x user --option labelclr=yellow",
    },
  ],
  seeAlso: ["tognuplot"],
};
