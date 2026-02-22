/**
 * Generate VitePress reference documentation from CommandDoc metadata.
 *
 * This ensures that --help, man pages, and the website reference all come
 * from the same CommandDoc source of truth.
 *
 * Usage: bun scripts/generate-reference-docs.ts
 * Output: docs/reference/<command>.md for each operation, plus docs/reference/index.md
 */

import type {
  CommandDoc,
  OptionDoc,
  ExampleDoc,
} from "../src/types/CommandDoc.ts";
import { loadAllDocs } from "../src/cli/help.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DOCS_DIR = join(import.meta.dir, "..", "docs", "reference");
const CATEGORIES = ["input", "transform", "output"] as const;

/**
 * Escape angle brackets in text so Vue doesn't treat <foo> as HTML tags.
 * Converts <word> patterns to &lt;word&gt; when they appear in prose.
 */
function escapeAngleBrackets(text: string): string {
  return text.replace(/<([^>]+)>/g, "&lt;$1&gt;");
}

const CATEGORY_LABELS: Record<string, string> = {
  input: "Input Operations",
  transform: "Transform Operations",
  output: "Output Operations",
};

function formatOptionRow(opt: OptionDoc): string {
  const flags = opt.flags.map((f) => `\`${f}\``).join(" / ");
  const argStr = opt.argument ? ` \`${opt.argument}\`` : "";
  const reqStr = opt.required ? " **(required)**" : "";
  return `| ${flags}${argStr} | ${escapeAngleBrackets(opt.description)}${reqStr} |`;
}

function formatExample(ex: ExampleDoc): string {
  const lines: string[] = [];
  lines.push(`### ${ex.description}`);

  lines.push("```bash");
  lines.push(ex.command);
  lines.push("```");

  if (ex.input) {
    lines.push("");
    lines.push("Input:");
    lines.push("```json");
    lines.push(ex.input);
    lines.push("```");
  }

  if (ex.output) {
    lines.push("");
    lines.push("Output:");
    lines.push("```json");
    lines.push(ex.output);
    lines.push("```");
  }

  return lines.join("\n");
}

function docToMarkdown(doc: CommandDoc): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${doc.name}`);
  lines.push("");

  // Short description (first sentence)
  const shortDesc = doc.description.split(". ")[0] ?? doc.description;
  lines.push(
    escapeAngleBrackets(shortDesc) + (shortDesc.endsWith(".") ? "" : ".")
  );
  lines.push("");

  // Synopsis
  lines.push("## Synopsis");
  lines.push("");
  lines.push("```bash");
  lines.push(doc.synopsis);
  lines.push("```");
  lines.push("");

  // Description
  lines.push("## Description");
  lines.push("");
  for (const paragraph of doc.description.split("\n\n")) {
    lines.push(escapeAngleBrackets(paragraph.trim()));
    lines.push("");
  }

  // Options
  if (doc.options.length > 0) {
    lines.push("## Options");
    lines.push("");
    lines.push("| Flag | Description |");
    lines.push("|------|-------------|");
    for (const opt of doc.options) {
      lines.push(formatOptionRow(opt));
    }
    lines.push("");
  }

  // Examples
  if (doc.examples.length > 0) {
    lines.push("## Examples");
    lines.push("");
    for (const ex of doc.examples) {
      lines.push(formatExample(ex));
      lines.push("");
    }
  }

  // See Also
  if (doc.seeAlso && doc.seeAlso.length > 0) {
    lines.push("## See Also");
    lines.push("");
    for (const ref of doc.seeAlso) {
      lines.push(`- [${ref}](./${ref})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function generateIndexPage(allDocs: CommandDoc[]): string {
  const lines: string[] = [];

  lines.push("# Command Reference");
  lines.push("");
  lines.push(
    "Every recs command, organized by category. Click any command name for full documentation with options, examples, and usage notes."
  );
  lines.push("");

  const categoryDescriptions: Record<string, string> = {
    input: "These commands create records from external data sources.",
    transform: "These commands reshape, filter, sort, and aggregate records.",
    output:
      "These commands render records into human-readable or machine-readable formats.",
  };

  for (const cat of CATEGORIES) {
    const catDocs = allDocs
      .filter((d) => d.category === cat)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (catDocs.length === 0) continue;

    lines.push(`## ${CATEGORY_LABELS[cat]}`);
    lines.push("");
    lines.push(categoryDescriptions[cat]!);
    lines.push("");
    lines.push("| Command | Description |");
    lines.push("|---------|-------------|");

    for (const doc of catDocs) {
      const shortDesc = doc.description.split(". ")[0] ?? doc.description;
      lines.push(
        `| [${doc.name}](./${doc.name}) | ${escapeAngleBrackets(shortDesc)} |`
      );
    }

    lines.push("");
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  mkdirSync(DOCS_DIR, { recursive: true });

  const allDocs = await loadAllDocs();

  // Generate individual command pages
  for (const doc of allDocs) {
    const mdContent = docToMarkdown(doc);
    const mdFile = join(DOCS_DIR, `${doc.name}.md`);
    writeFileSync(mdFile, mdContent);
  }

  // Generate index page
  const indexContent = generateIndexPage(allDocs);
  writeFileSync(join(DOCS_DIR, "index.md"), indexContent);

  console.log(
    `Generated ${allDocs.length} reference pages + index in ${DOCS_DIR}`
  );
}

main();
