/**
 * Generate troff man pages from CommandDoc metadata.
 *
 * Usage: bun scripts/generate-manpages.ts
 * Output: man/man1/recs-<command>.1 for each operation, plus recs.1
 */

import type { CommandDoc } from "../src/types/CommandDoc.ts";
import { loadAllDocs } from "../src/cli/help.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MAN_DIR = join(import.meta.dir, "..", "man", "man1");
const CATEGORIES = ["input", "transform", "output"] as const;
const DATE = new Date().toISOString().slice(0, 10);

function escapeMan(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/-/g, "\\-")
    .replace(/'/g, "\\'");
}

function rawMan(text: string): string {
  // For content that should NOT escape dashes (like flags)
  return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function docToManPage(doc: CommandDoc): string {
  const lines: string[] = [];

  // Header
  lines.push(`.TH RECS\\-${doc.name.toUpperCase()} 1 "${DATE}" "recs 0.1.0" "RecordStream Manual"`);
  lines.push("");

  // NAME
  lines.push(".SH NAME");
  lines.push(
    `recs\\-${doc.name} \\- ${escapeMan(doc.description.split(".")[0] ?? doc.description)}`
  );
  lines.push("");

  // SYNOPSIS
  lines.push(".SH SYNOPSIS");
  lines.push(`.B ${rawMan(doc.synopsis)}`);
  lines.push("");

  // DESCRIPTION
  lines.push(".SH DESCRIPTION");
  for (const paragraph of doc.description.split("\n\n")) {
    lines.push(escapeMan(paragraph.trim()));
    lines.push(".PP");
  }
  lines.push("");

  // OPTIONS
  if (doc.options.length > 0) {
    lines.push(".SH OPTIONS");
    for (const opt of doc.options) {
      const flagStr = opt.flags
        .map((f) => `\\fB${rawMan(f)}\\fR`)
        .join(", ");
      const argStr = opt.argument ? ` \\fI${rawMan(opt.argument)}\\fR` : "";
      lines.push(`.TP`);
      lines.push(`${flagStr}${argStr}`);
      lines.push(escapeMan(opt.description));
    }
    lines.push("");
  }

  // EXAMPLES
  if (doc.examples.length > 0) {
    lines.push(".SH EXAMPLES");
    for (const ex of doc.examples) {
      lines.push(escapeMan(ex.description));
      lines.push(".PP");
      lines.push(".RS 4");
      lines.push(`.nf`);
      lines.push(`\\fB${rawMan(ex.command)}\\fR`);
      lines.push(`.fi`);
      lines.push(".RE");
      if (ex.input) {
        lines.push(".PP");
        lines.push("Input:");
        lines.push(".RS 4");
        lines.push(`.nf`);
        lines.push(rawMan(ex.input));
        lines.push(`.fi`);
        lines.push(".RE");
      }
      if (ex.output) {
        lines.push(".PP");
        lines.push("Output:");
        lines.push(".RS 4");
        lines.push(`.nf`);
        lines.push(rawMan(ex.output));
        lines.push(`.fi`);
        lines.push(".RE");
      }
      lines.push("");
    }
  }

  // SEE ALSO
  if (doc.seeAlso && doc.seeAlso.length > 0) {
    lines.push(".SH SEE ALSO");
    const refs = doc.seeAlso.map(
      (name) => `\\fBrecs\\-${rawMan(name)}\\fR(1)`
    );
    lines.push(refs.join(", "));
    lines.push("");
  }

  // AUTHOR
  lines.push(".SH AUTHOR");
  lines.push("Benjamin Bernard <perlhacker@benjaminbernard.com>");
  lines.push("");

  return lines.join("\n") + "\n";
}

function generateMainManPage(allDocs: CommandDoc[]): string {
  const lines: string[] = [];

  lines.push(`.TH RECS 1 "${DATE}" "recs 0.1.0" "RecordStream Manual"`);
  lines.push("");

  lines.push(".SH NAME");
  lines.push("recs \\- a toolkit for taming JSON record streams");
  lines.push("");

  lines.push(".SH SYNOPSIS");
  lines.push(".B recs");
  lines.push("<command> [options] [files...]");
  lines.push("");

  lines.push(".SH DESCRIPTION");
  lines.push(
    "RecordStream is a collection of commands for creating, transforming, " +
      "and outputting JSON records. Records are JSON objects, one per line. " +
      "Commands are composed using Unix pipes."
  );
  lines.push(".PP");
  lines.push(
    "Commands fall into three categories: input commands (from*) that create " +
      "records, transform commands that reshape them, and output commands (to*) " +
      "that render them."
  );
  lines.push("");

  // Commands by category
  for (const cat of CATEGORIES) {
    const catDocs = allDocs.filter((d) => d.category === cat);
    const catTitle =
      cat === "input"
        ? "INPUT COMMANDS"
        : cat === "transform"
          ? "TRANSFORM COMMANDS"
          : "OUTPUT COMMANDS";

    lines.push(`.SH ${catTitle}`);
    for (const doc of catDocs.sort((a, b) => a.name.localeCompare(b.name))) {
      const shortDesc = doc.description.split(".")[0] ?? doc.description;
      lines.push(".TP");
      lines.push(`\\fBrecs ${rawMan(doc.name)}\\fR`);
      lines.push(escapeMan(shortDesc));
    }
    lines.push("");
  }

  lines.push(".SH AUTHOR");
  lines.push("Benjamin Bernard <perlhacker@benjaminbernard.com>");
  lines.push("");

  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  mkdirSync(MAN_DIR, { recursive: true });

  const allDocs = await loadAllDocs();

  for (const doc of allDocs) {
    const manContent = docToManPage(doc);
    const manFile = join(MAN_DIR, `recs-${doc.name}.1`);
    writeFileSync(manFile, manContent);
  }

  // Generate main recs.1 page
  const mainPage = generateMainManPage(allDocs);
  writeFileSync(join(MAN_DIR, "recs.1"), mainPage);

  console.log(
    `Generated ${allDocs.length + 1} man pages in ${MAN_DIR}`
  );
}

main();
