import { Record } from "../../Record.ts";
import { Operation, type RecordReceiver, type OptionDef } from "../../Operation.ts";
import { KeyGroups } from "../../KeyGroups.ts";
import { findKey } from "../../KeySpec.ts";

// ── Unicode block characters ────────────────────────────────────

/** Left-aligned horizontal bar fractional blocks (0/8 to 8/8) */
const H_BLOCKS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];

/** Vertical sparkline blocks (0/8 to 8/8) */
const V_BLOCKS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

// ── ANSI colors ─────────────────────────────────────────────────

const COLORS = [
  "\x1b[36m", // cyan
  "\x1b[32m", // green
  "\x1b[33m", // yellow
  "\x1b[35m", // magenta
  "\x1b[31m", // red
  "\x1b[34m", // blue
];
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

// ── Braille canvas for line / scatter plots ─────────────────────

/**
 * Braille dot matrix per character cell (2 cols × 4 rows):
 *   (col0,row0)=0x01  (col1,row0)=0x08
 *   (col0,row1)=0x02  (col1,row1)=0x10
 *   (col0,row2)=0x04  (col1,row2)=0x20
 *   (col0,row3)=0x40  (col1,row3)=0x80
 */
const BRAILLE_BASE = 0x2800;
const BRAILLE_DOTS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

class BrailleCanvas {
  charWidth: number;
  charHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  grid: number[][];

  constructor(charWidth: number, charHeight: number) {
    this.charWidth = charWidth;
    this.charHeight = charHeight;
    this.pixelWidth = charWidth * 2;
    this.pixelHeight = charHeight * 4;
    this.grid = [];
    for (let r = 0; r < charHeight; r++) {
      this.grid.push(Array.from({ length: charWidth }, () => 0));
    }
  }

  /** Set a pixel. Origin is bottom-left: (0,0) = bottom-left corner. */
  set(px: number, py: number): void {
    if (px < 0 || px >= this.pixelWidth || py < 0 || py >= this.pixelHeight) return;
    const flippedY = this.pixelHeight - 1 - py;
    const col = Math.floor(px / 2);
    const row = Math.floor(flippedY / 4);
    const dotCol = px % 2;
    const dotRow = flippedY % 4;
    this.grid[row]![col]! |= BRAILLE_DOTS[dotRow]![dotCol]!;
  }

  /** Draw a line between two pixel coordinates using Bresenham's algorithm. */
  drawLine(x0: number, y0: number, x1: number, y1: number): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;

    for (;;) {
      this.set(x, y);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  /** Render the canvas to an array of strings (one per character row). */
  render(): string[] {
    const lines: string[] = [];
    for (let r = 0; r < this.charHeight; r++) {
      let line = "";
      for (let c = 0; c < this.charWidth; c++) {
        line += String.fromCharCode(BRAILLE_BASE + this.grid[r]![c]!);
      }
      lines.push(line);
    }
    return lines;
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function centerText(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

function horizontalBar(length: number): string {
  if (length <= 0) return "";
  const full = Math.floor(length);
  const frac = Math.round((length - full) * 8);
  let bar = "█".repeat(full);
  if (frac > 0 && frac < 8) {
    bar += H_BLOCKS[frac]!;
  }
  return bar;
}

// ── Chart types ─────────────────────────────────────────────────

const VALID_TYPES = ["bar", "line", "scatter", "sparkline"];

// ── Operation ───────────────────────────────────────────────────

/**
 * Render terminal charts from a record stream.
 *
 * Supports bar charts (horizontal Unicode bars), line charts (braille
 * canvas), scatter plots (braille canvas), and sparklines (compact
 * vertical block characters). Optional SVG file output.
 */
export class ToChart extends Operation {
  chartType = "bar";
  title = "";
  chartWidth = 80;
  chartHeight = 20;
  labelKeyName = "";
  useColor = true;
  outputFile = "";
  dumpSpec = false;
  keyGroups = new KeyGroups();

  fields: string[] = [];
  firstRecord = true;
  labels: string[] = [];
  seriesData: number[][] = [];
  recordIndex = 0;

  constructor(next?: RecordReceiver) {
    super(next);
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "key",
        short: "k",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Keys to chart (value fields to plot)",
      },
      {
        long: "fields",
        short: "f",
        type: "string",
        handler: (v) => { this.keyGroups.addGroups(v as string); },
        description: "Keys to chart (value fields to plot)",
      },
      {
        long: "type",
        type: "string",
        handler: (v) => { this.chartType = v as string; },
        description: "Chart type: bar, line, scatter, sparkline (default: bar)",
      },
      {
        long: "title",
        type: "string",
        handler: (v) => { this.title = v as string; },
        description: "Chart title",
      },
      {
        long: "width",
        type: "string",
        handler: (v) => { this.chartWidth = parseInt(v as string, 10); },
        description: "Chart width in characters (default: 80)",
      },
      {
        long: "height",
        type: "string",
        handler: (v) => { this.chartHeight = parseInt(v as string, 10); },
        description: "Chart height in character rows (default: 20)",
      },
      {
        long: "label-key",
        type: "string",
        handler: (v) => { this.labelKeyName = v as string; },
        description: "Key to use for bar labels or x-axis categories",
      },
      {
        long: "color",
        type: "boolean",
        handler: (v) => { this.useColor = v as boolean; },
        description: "Enable ANSI colors (default: true, use --no-color to disable)",
      },
      {
        long: "output-file",
        type: "string",
        handler: (v) => { this.outputFile = v as string; },
        description: "Write SVG chart to file instead of terminal output",
      },
      {
        long: "dump-spec",
        type: "boolean",
        handler: () => { this.dumpSpec = true; },
        description: "Dump parsed configuration and data (for testing)",
      },
    ];

    this.parseOptions(args, defs);

    if (!VALID_TYPES.includes(this.chartType)) {
      throw new Error(
        `Invalid chart type: ${this.chartType}. Must be one of: ${VALID_TYPES.join(", ")}`
      );
    }

    if (!this.keyGroups.hasAnyGroup()) {
      throw new Error("Must specify at least one field with --key");
    }

    if (this.dumpSpec) {
      this.pushLine("type: " + this.chartType);
      this.pushLine("width: " + this.chartWidth);
      this.pushLine("height: " + this.chartHeight);
      if (this.title) this.pushLine("title: " + this.title);
      if (this.labelKeyName) this.pushLine("label-key: " + this.labelKeyName);
      this.pushLine("color: " + this.useColor);
      if (this.outputFile) this.pushLine("output-file: " + this.outputFile);
    }
  }

  initFields(record: Record): void {
    const data = record.dataRef();
    this.fields = this.keyGroups.getKeyspecs(data);

    if (this.dumpSpec) {
      for (const field of this.fields) {
        this.pushLine("field: " + field);
      }
    }

    for (let i = 0; i < this.fields.length; i++) {
      this.seriesData.push([]);
    }
  }

  acceptRecord(record: Record): boolean {
    if (this.firstRecord) {
      this.firstRecord = false;
      this.initFields(record);
    }

    const data = record.dataRef();
    this.recordIndex++;

    // Collect label
    if (this.labelKeyName) {
      const label = findKey(data, this.labelKeyName, true);
      this.labels.push(
        label !== undefined && label !== null ? String(label) : String(this.recordIndex)
      );
    } else {
      this.labels.push(String(this.recordIndex));
    }

    // Collect numeric data for each series
    for (let i = 0; i < this.fields.length; i++) {
      const value = findKey(data, this.fields[i]!, true);
      const num = typeof value === "number" ? value : parseFloat(String(value));
      this.seriesData[i]!.push(isNaN(num) ? 0 : num);
    }

    if (this.dumpSpec) {
      const parts: string[] = [];
      if (this.labelKeyName) {
        parts.push(this.labels[this.labels.length - 1]!);
      }
      for (let i = 0; i < this.fields.length; i++) {
        parts.push(String(this.seriesData[i]![this.seriesData[i]!.length - 1]));
      }
      this.pushLine(parts.join(" "));
    }

    return true;
  }

  override streamDone(): void {
    if (this.dumpSpec) return;
    if (this.seriesData.length === 0 || this.seriesData[0]!.length === 0) return;

    if (this.outputFile) {
      this.writeSvg();
      return;
    }

    let lines: string[];
    switch (this.chartType) {
      case "line":
        lines = this.renderLine();
        break;
      case "scatter":
        lines = this.renderScatter();
        break;
      case "sparkline":
        lines = this.renderSparkline();
        break;
      default:
        lines = this.renderBar();
    }

    for (const line of lines) {
      this.pushLine(line);
    }
  }

  // ── Bar chart ───────────────────────────────────────────────

  renderBar(): string[] {
    const lines: string[] = [];
    const n = this.seriesData[0]!.length;
    const numSeries = this.fields.length;

    const maxValue = Math.max(...this.seriesData.flat(), 0);

    // Format value strings
    const formatted: string[][] = [];
    let maxValWidth = 0;
    for (let s = 0; s < numSeries; s++) {
      const row: string[] = [];
      for (let i = 0; i < n; i++) {
        const str = formatNum(this.seriesData[s]![i]!);
        row.push(str);
        maxValWidth = Math.max(maxValWidth, str.length);
      }
      formatted.push(row);
    }

    // Label widths
    let maxLabelWidth = 0;
    for (const label of this.labels) {
      maxLabelWidth = Math.max(maxLabelWidth, label.length);
    }

    const barArea = this.chartWidth - maxLabelWidth - 2 - maxValWidth - 1;
    if (barArea < 3) {
      lines.push("Chart width too small for data");
      return lines;
    }

    // Title
    if (this.title) {
      lines.push(this.c(BOLD, centerText(this.title, this.chartWidth)));
      lines.push("");
    }

    // Legend for multi-series
    if (numSeries > 1) {
      const parts: string[] = [];
      for (let s = 0; s < numSeries; s++) {
        const clr = COLORS[s % COLORS.length]!;
        parts.push(this.c(clr, "█") + " " + this.fields[s]!);
      }
      lines.push("  " + parts.join("  "));
      lines.push("");
    }

    // Bars
    for (let i = 0; i < n; i++) {
      const label = this.labels[i]!.padStart(maxLabelWidth);
      for (let s = 0; s < numSeries; s++) {
        const value = this.seriesData[s]![i]!;
        const valStr = formatted[s]![i]!;
        const barLen = maxValue > 0 ? (value / maxValue) * barArea : 0;
        const bar = horizontalBar(Math.max(barLen, 0));
        const clr = COLORS[s % COLORS.length]!;

        if (s === 0) {
          lines.push(
            this.c(DIM, label) + "  " +
            this.c(clr, bar) + " " +
            this.c(DIM, valStr.padStart(maxValWidth))
          );
        } else {
          lines.push(
            " ".repeat(maxLabelWidth) + "  " +
            this.c(clr, bar) + " " +
            this.c(DIM, valStr.padStart(maxValWidth))
          );
        }
      }
    }

    return lines;
  }

  // ── Line chart ──────────────────────────────────────────────

  renderLine(): string[] {
    const lines: string[] = [];
    const numSeries = this.fields.length;
    const n = this.seriesData[0]!.length;

    const allValues = this.seriesData.flat();
    const maxVal = Math.max(...allValues);
    const minVal = Math.min(...allValues);
    const range = maxVal - minVal || 1;

    const yLabelW = Math.max(formatNum(maxVal).length, formatNum(minVal).length) + 1;
    const canvasW = this.chartWidth - yLabelW - 1;
    const canvasH = this.chartHeight - (this.title ? 2 : 0) - 1;

    if (canvasW < 5 || canvasH < 3) {
      lines.push("Chart dimensions too small");
      return lines;
    }

    if (this.title) {
      lines.push(this.c(BOLD, centerText(this.title, this.chartWidth)));
      if (numSeries > 1) {
        const parts: string[] = [];
        for (let s = 0; s < numSeries; s++) {
          parts.push(this.c(COLORS[s % COLORS.length]!, "━━") + " " + this.fields[s]!);
        }
        lines.push("  " + parts.join("  "));
      }
    }

    const canvas = new BrailleCanvas(canvasW, canvasH);

    for (let s = 0; s < numSeries; s++) {
      const data = this.seriesData[s]!;
      let prevX = -1, prevY = -1;
      for (let i = 0; i < n; i++) {
        const px = n === 1 ? Math.floor(canvas.pixelWidth / 2) :
          Math.round((i / (n - 1)) * (canvas.pixelWidth - 1));
        const py = Math.round(((data[i]! - minVal) / range) * (canvas.pixelHeight - 1));
        if (prevX >= 0) {
          canvas.drawLine(prevX, prevY, px, py);
        }
        canvas.set(px, py);
        prevX = px;
        prevY = py;
      }
    }

    const canvasLines = canvas.render();
    const midRow = Math.floor(canvasH / 2);
    for (let r = 0; r < canvasH; r++) {
      let yLabel: string;
      if (r === 0) {
        yLabel = formatNum(maxVal).padStart(yLabelW);
      } else if (r === canvasH - 1) {
        yLabel = formatNum(minVal).padStart(yLabelW);
      } else if (r === midRow) {
        yLabel = formatNum((maxVal + minVal) / 2).padStart(yLabelW);
      } else {
        yLabel = " ".repeat(yLabelW);
      }
      const ax = (r === 0 || r === canvasH - 1 || r === midRow) ? "┤" : "│";
      const content = numSeries === 1
        ? this.c(COLORS[0]!, canvasLines[r]!)
        : canvasLines[r]!;
      lines.push(this.c(DIM, yLabel + ax) + content);
    }

    lines.push(this.c(DIM, " ".repeat(yLabelW) + "└" + "─".repeat(canvasW)));

    return lines;
  }

  // ── Scatter chart ───────────────────────────────────────────

  renderScatter(): string[] {
    if (this.fields.length < 2) {
      return ["Scatter chart requires at least 2 fields (x, y)"];
    }

    const lines: string[] = [];
    const xData = this.seriesData[0]!;
    const n = xData.length;
    const ySeries = this.seriesData.slice(1);
    const yCount = ySeries.length;

    const allY = ySeries.flat();
    const maxY = Math.max(...allY);
    const minY = Math.min(...allY);
    const maxX = Math.max(...xData);
    const minX = Math.min(...xData);
    const rangeY = maxY - minY || 1;
    const rangeX = maxX - minX || 1;

    const yLabelW = Math.max(formatNum(maxY).length, formatNum(minY).length) + 1;
    const canvasW = this.chartWidth - yLabelW - 1;
    const canvasH = this.chartHeight - (this.title ? 2 : 0) - 1;

    if (canvasW < 5 || canvasH < 3) {
      lines.push("Chart dimensions too small");
      return lines;
    }

    if (this.title) {
      lines.push(this.c(BOLD, centerText(this.title, this.chartWidth)));
      if (yCount > 1) {
        const parts: string[] = [];
        for (let s = 0; s < yCount; s++) {
          parts.push(this.c(COLORS[s % COLORS.length]!, "⣿") + " " + this.fields[s + 1]!);
        }
        lines.push("  " + parts.join("  "));
      }
    }

    const canvas = new BrailleCanvas(canvasW, canvasH);

    for (let s = 0; s < yCount; s++) {
      const yData = ySeries[s]!;
      for (let i = 0; i < n; i++) {
        const px = Math.round(((xData[i]! - minX) / rangeX) * (canvas.pixelWidth - 1));
        const py = Math.round(((yData[i]! - minY) / rangeY) * (canvas.pixelHeight - 1));
        canvas.set(px, py);
      }
    }

    const canvasLines = canvas.render();
    const midRow = Math.floor(canvasH / 2);
    for (let r = 0; r < canvasH; r++) {
      let yLabel: string;
      if (r === 0) {
        yLabel = formatNum(maxY).padStart(yLabelW);
      } else if (r === canvasH - 1) {
        yLabel = formatNum(minY).padStart(yLabelW);
      } else if (r === midRow) {
        yLabel = formatNum((maxY + minY) / 2).padStart(yLabelW);
      } else {
        yLabel = " ".repeat(yLabelW);
      }
      const ax = (r === 0 || r === canvasH - 1 || r === midRow) ? "┤" : "│";
      const content = yCount === 1
        ? this.c(COLORS[0]!, canvasLines[r]!)
        : canvasLines[r]!;
      lines.push(this.c(DIM, yLabel + ax) + content);
    }

    lines.push(this.c(DIM, " ".repeat(yLabelW) + "└" + "─".repeat(canvasW)));

    return lines;
  }

  // ── Sparkline ───────────────────────────────────────────────

  renderSparkline(): string[] {
    const lines: string[] = [];

    if (this.title) {
      lines.push(this.c(BOLD, this.title));
    }

    for (let s = 0; s < this.fields.length; s++) {
      const data = this.seriesData[s]!;
      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;

      let spark = "";
      for (const value of data) {
        const norm = (value - min) / range;
        const idx = Math.round(norm * 8);
        spark += V_BLOCKS[Math.min(idx, 8)]!;
      }

      const clr = COLORS[s % COLORS.length]!;
      lines.push(
        this.fields[s]! + " " +
        this.c(DIM, formatNum(min) + " ") +
        this.c(clr, spark) +
        this.c(DIM, " " + formatNum(max))
      );
    }

    return lines;
  }

  // ── SVG output ──────────────────────────────────────────────

  writeSvg(): void {
    const w = 800;
    const h = 400;
    const margin = 60;
    const plotW = w - 2 * margin;
    const plotH = h - 2 * margin;
    const n = this.seriesData[0]!.length;
    const svgColors = ["#0ea5e9", "#22c55e", "#eab308", "#a855f7", "#ef4444", "#3b82f6"];

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#1e1e2e" rx="8"/>
<style>text{fill:#cdd6f4;font-family:system-ui,sans-serif}</style>
`;

    if (this.title) {
      svg += `<text x="${w / 2}" y="30" text-anchor="middle" font-size="16" font-weight="bold">${escapeXml(this.title)}</text>\n`;
    }

    // Axes
    svg += `<line x1="${margin}" y1="${margin}" x2="${margin}" y2="${h - margin}" stroke="#585b70" stroke-width="1"/>\n`;
    svg += `<line x1="${margin}" y1="${h - margin}" x2="${w - margin}" y2="${h - margin}" stroke="#585b70" stroke-width="1"/>\n`;

    if (this.chartType === "bar") {
      const maxVal = Math.max(...this.seriesData.flat(), 0);
      const numSeries = this.fields.length;
      const groupH = plotH / n;
      const barH = groupH / (numSeries + 0.5);

      for (let i = 0; i < n; i++) {
        // Label
        const cy = margin + i * groupH + groupH / 2;
        svg += `<text x="${margin - 8}" y="${cy + 4}" text-anchor="end" font-size="11">${escapeXml(this.labels[i]!)}</text>\n`;

        for (let s = 0; s < numSeries; s++) {
          const val = this.seriesData[s]![i]!;
          const barW = maxVal > 0 ? (val / maxVal) * plotW : 0;
          const y = margin + i * groupH + s * barH + barH * 0.25;
          const color = svgColors[s % svgColors.length]!;
          svg += `<rect x="${margin + 1}" y="${y}" width="${Math.max(barW, 0)}" height="${barH * 0.8}" fill="${color}" rx="3"/>\n`;
        }
      }
    } else if (this.chartType === "scatter" && this.fields.length >= 2) {
      const xData = this.seriesData[0]!;
      const ySeries = this.seriesData.slice(1);
      const allY = ySeries.flat();
      const minX = Math.min(...xData), maxX = Math.max(...xData);
      const minY = Math.min(...allY), maxY = Math.max(...allY);
      const rx = maxX - minX || 1, ry = maxY - minY || 1;

      for (let s = 0; s < ySeries.length; s++) {
        const color = svgColors[s % svgColors.length]!;
        for (let i = 0; i < n; i++) {
          const cx = margin + ((xData[i]! - minX) / rx) * plotW;
          const cy = h - margin - ((ySeries[s]![i]! - minY) / ry) * plotH;
          svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${color}" opacity="0.8"/>\n`;
        }
      }
    } else {
      // Line chart (also used as fallback)
      const allValues = this.seriesData.flat();
      const minVal = Math.min(...allValues), maxVal = Math.max(...allValues);
      const range = maxVal - minVal || 1;

      for (let s = 0; s < this.fields.length; s++) {
        const data = this.seriesData[s]!;
        const color = svgColors[s % svgColors.length]!;
        const points: string[] = [];
        for (let i = 0; i < n; i++) {
          const x = n === 1 ? margin + plotW / 2 : margin + (i / (n - 1)) * plotW;
          const y = h - margin - ((data[i]! - minVal) / range) * plotH;
          points.push(`${x},${y}`);
        }
        svg += `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>\n`;
        for (const pt of points) {
          const [cx, cy] = pt.split(",");
          svg += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${color}"/>\n`;
        }
      }

      // Y-axis labels
      svg += `<text x="${margin - 8}" y="${margin + 4}" text-anchor="end" font-size="11">${formatNum(maxVal)}</text>\n`;
      svg += `<text x="${margin - 8}" y="${h - margin + 4}" text-anchor="end" font-size="11">${formatNum(minVal)}</text>\n`;
    }

    // Legend
    if (this.fields.length > 1 || this.chartType !== "bar") {
      const legendFields = this.chartType === "scatter" ? this.fields.slice(1) : this.fields;
      for (let s = 0; s < legendFields.length; s++) {
        const color = svgColors[s % svgColors.length]!;
        const lx = w - margin;
        const ly = margin + s * 20;
        svg += `<rect x="${lx - 12}" y="${ly - 6}" width="10" height="10" fill="${color}" rx="2"/>\n`;
        svg += `<text x="${lx + 2}" y="${ly + 3}" font-size="11">${escapeXml(legendFields[s]!)}</text>\n`;
      }
    }

    svg += `</svg>`;

    try {
      Bun.write(this.outputFile, svg);
      this.pushLine("Wrote chart: " + this.outputFile);
    } catch (e) {
      console.error("Could not write chart file:", e);
    }
  }

  // ── Utilities ───────────────────────────────────────────────

  /** Apply ANSI color if color mode is on. */
  c(code: string, text: string): string {
    return this.useColor ? code + text + RESET : text;
  }

  override doesRecordOutput(): boolean {
    return false;
  }

  override usage(): string {
    return `Usage: recs tochart [options] [<files>]
   Render charts in the terminal from a record stream.

Options:
  --key|-k <keys>        Value keys to chart (required)
  --type <type>          Chart type: bar, line, scatter, sparkline (default: bar)
  --title <title>        Chart title
  --width <n>            Width in characters (default: 80)
  --height <n>           Height in character rows (default: 20)
  --label-key <key>      Key for bar labels or x-axis categories
  --color / --no-color   Enable/disable ANSI colors (default: enabled)
  --output-file <file>   Write SVG to file instead of terminal output
  --dump-spec            Dump parsed config (for testing)

Examples:
   Bar chart of counts by user
      recs tochart --key ct --label-key uid
   Line chart of values over time
      recs tochart --key value --type line --title "Trend"
   Sparkline
      recs tochart --key value --type sparkline`;
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ── CommandDoc ───────────────────────────────────────────────────

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "tochart",
  category: "output",
  synopsis: "recs tochart [options] [files...]",
  description:
    "Render charts in the terminal from a record stream. Supports bar charts " +
    "(horizontal Unicode block characters), line charts (braille-dot canvas), " +
    "scatter plots (braille-dot canvas), and sparklines (vertical block characters). " +
    "Can optionally write SVG output to a file.",
  options: [
    {
      flags: ["--key", "-k", "--fields", "-f"],
      argument: "<keys>",
      description:
        "Value keys to chart. May be specified multiple times or comma-separated.",
      required: true,
    },
    {
      flags: ["--type"],
      argument: "<type>",
      description:
        "Chart type: bar (horizontal bars), line (braille line plot), scatter (braille scatter), sparkline (compact block characters). Default: bar.",
    },
    {
      flags: ["--title"],
      argument: "<title>",
      description: "Title displayed above the chart.",
    },
    {
      flags: ["--width"],
      argument: "<n>",
      description: "Chart width in characters. Default: 80.",
    },
    {
      flags: ["--height"],
      argument: "<n>",
      description: "Chart height in character rows. Default: 20.",
    },
    {
      flags: ["--label-key"],
      argument: "<key>",
      description:
        "Key to use for bar labels or x-axis category names. If not specified, records are labeled by index.",
    },
    {
      flags: ["--color", "--no-color"],
      description:
        "Enable or disable ANSI color output. Colors are enabled by default.",
    },
    {
      flags: ["--output-file"],
      argument: "<file>",
      description:
        "Write an SVG chart to the specified file instead of rendering to the terminal.",
    },
    {
      flags: ["--dump-spec"],
      description: "Dump parsed configuration and data lines (for testing).",
    },
  ],
  examples: [
    {
      description: "Bar chart of counts by user",
      command: "recs tochart --key ct --label-key uid",
    },
    {
      description: "Line chart of values",
      command: "recs tochart --key value --type line --title 'Values over time'",
    },
    {
      description: "Scatter plot of x vs y",
      command: "recs tochart --key x,y --type scatter",
    },
    {
      description: "Sparkline of a value field",
      command: "recs tochart --key value --type sparkline",
    },
    {
      description: "Save chart as SVG",
      command: "recs tochart --key ct --label-key uid --output-file chart.svg",
    },
    {
      description: "Multiple series bar chart",
      command: "recs tochart --key sales,profit --label-key region --title 'By Region'",
    },
  ],
  seeAlso: ["tognuplot", "togdgraph"],
};
