#!/usr/bin/env bun
/**
 * Main CLI entry point for RecordStream.
 *
 * Usage:
 *   recs <command> [options] [files...]
 *   recs help [command]
 *   recs --help
 *   recs --version
 */

import { loadAllDocs, loadDocForCommand, docToHelpText, formatCommandList } from "../src/cli/help.ts";
import { runOperation } from "../src/cli/dispatcher.ts";

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === "help" || command === "--help" || command === "-h") {
  const subcommand = args[1];

  if (subcommand) {
    // recs help <command>
    const doc = await loadDocForCommand(subcommand);
    if (!doc) {
      console.error(`Unknown command: ${subcommand}`);
      console.error("Run 'recs help' for a list of commands.");
      process.exit(1);
    }
    console.log(docToHelpText(doc));
  } else {
    // recs help  /  recs --help  /  recs (no args)
    const docs = await loadAllDocs();
    console.log(formatCommandList(docs));
  }
  process.exit(0);
}

if (command === "--version" || command === "-V") {
  console.log("recs 0.1.0");
  process.exit(0);
}

if (command === "--list" || command === "-l" || command === "list") {
  const docs = await loadAllDocs();
  for (const doc of docs.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(doc.name);
  }
  process.exit(0);
}

if (command === "examples") {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const docsDir = join(import.meta.dir, "..", "docs", "guide");
  try {
    const content = readFileSync(join(docsDir, "examples.md"), "utf-8");
    console.log(content);
  } catch {
    console.error("Examples documentation not found.");
    process.exit(1);
  }
  process.exit(0);
}

if (command === "story") {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const docsDir = join(import.meta.dir, "..", "docs", "guide");
  try {
    const content = readFileSync(join(docsDir, "story.md"), "utf-8");
    console.log(content);
  } catch {
    console.error("Story documentation not found.");
    process.exit(1);
  }
  process.exit(0);
}

// Dispatch to the operation
const exitCode = await runOperation(command, args.slice(1));
process.exit(exitCode);
