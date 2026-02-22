/**
 * Help text formatting and documentation loading for the recs CLI.
 *
 * Provides terminal-friendly help output from CommandDoc metadata.
 */

import type { CommandDoc } from "../types/CommandDoc.ts";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const OPS_ROOT = join(import.meta.dir, "..", "operations");
const CATEGORIES = ["input", "transform", "output"] as const;

/**
 * Load all CommandDoc exports from every operation file.
 */
export async function loadAllDocs(): Promise<CommandDoc[]> {
  const docs: CommandDoc[] = [];

  for (const category of CATEGORIES) {
    const dir = join(OPS_ROOT, category);
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && f !== "index.ts"
    );

    for (const file of files) {
      const modulePath = join(OPS_ROOT, category, file);
      const mod = (await import(modulePath)) as Record<string, unknown>;
      const doc = mod["documentation"] as CommandDoc | undefined;
      if (doc) {
        docs.push(doc);
      }
    }
  }

  return docs;
}

/**
 * Load the CommandDoc for a single command by name.
 * Returns undefined if no matching command is found.
 */
export async function loadDocForCommand(
  commandName: string
): Promise<CommandDoc | undefined> {
  const docs = await loadAllDocs();
  return docs.find((d) => d.name === commandName);
}

function wordWrap(text: string, width: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 > width && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

/**
 * Format a CommandDoc as terminal-friendly help text.
 */
export function docToHelpText(doc: CommandDoc, width = 80): string {
  const lines: string[] = [];

  lines.push(`Usage: ${doc.synopsis}`);
  lines.push("");
  lines.push(wordWrap(doc.description, width));
  lines.push("");

  if (doc.options.length > 0) {
    lines.push("Options:");
    for (const opt of doc.options) {
      const flags = opt.flags.join(", ");
      const argStr = opt.argument ? ` ${opt.argument}` : "";
      lines.push(`  ${flags}${argStr}`);
      lines.push(`      ${wordWrap(opt.description, width - 6)}`);
    }
    lines.push("");
  }

  if (doc.examples.length > 0) {
    lines.push("Examples:");
    for (const ex of doc.examples) {
      lines.push(`  ${ex.description}`);
      lines.push(`    ${ex.command}`);
      lines.push("");
    }
  }

  if (doc.seeAlso && doc.seeAlso.length > 0) {
    lines.push(
      `See also: ${doc.seeAlso.map((s) => `recs ${s}`).join(", ")}`
    );
  }

  return lines.join("\n");
}

/**
 * Format a list of all commands grouped by category.
 */
export function formatCommandList(docs: CommandDoc[]): string {
  const lines: string[] = [];

  lines.push("Usage: recs <command> [options] [files...]");
  lines.push("");
  lines.push(
    "RecordStream is a toolkit for creating, transforming, and outputting"
  );
  lines.push("JSON record streams. Records are JSON objects, one per line.");
  lines.push("");

  const categories: Array<{
    label: string;
    filter: CommandDoc["category"];
  }> = [
    { label: "Input commands", filter: "input" },
    { label: "Transform commands", filter: "transform" },
    { label: "Output commands", filter: "output" },
  ];

  for (const { label, filter } of categories) {
    const catDocs = docs
      .filter((d) => d.category === filter)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (catDocs.length === 0) continue;

    lines.push(`${label}:`);
    const maxName = Math.max(...catDocs.map((d) => d.name.length));
    for (const doc of catDocs) {
      const shortDesc = doc.description.split(".")[0] ?? doc.description;
      lines.push(`  ${doc.name.padEnd(maxName + 2)}${shortDesc}`);
    }
    lines.push("");
  }

  lines.push("Run 'recs help <command>' for detailed help on a command.");

  return lines.join("\n");
}
