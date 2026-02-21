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

// Dispatch to the operation
// For now, the CLI entry point handles help; actual operation dispatch
// will be implemented by the CLI dispatcher task (#11).
console.error(
  `Command dispatch not yet implemented. Use 'recs help ${command}' for help.`
);
process.exit(1);
