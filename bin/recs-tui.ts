#!/usr/bin/env bun
/**
 * CLI entry point for the RecordStream TUI pipeline builder.
 *
 * Usage:
 *   recs tui [inputfile]          Open TUI with optional input file
 *   recs tui --session <id>       Resume a saved session
 *   recs tui --list               List saved sessions
 *   recs tui --clean              Remove sessions older than 7 days
 *   recs tui --pipeline "..."     Start with an initial pipeline command
 */

import { launchTui, type TuiOptions } from "../src/tui/index.tsx";

const args = process.argv.slice(2);

// Handle --list
if (args.includes("--list")) {
  // TODO: implement session listing (Phase 3)
  console.log("No saved sessions. (Session persistence coming in Phase 3)");
  process.exit(0);
}

// Handle --clean
if (args.includes("--clean")) {
  // TODO: implement session cleanup (Phase 3)
  console.log("Session cleanup not yet implemented. (Phase 3)");
  process.exit(0);
}

// Parse options
const options: TuiOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;

  if (arg === "--session" || arg === "-s") {
    options.sessionId = args[i + 1];
    i++; // skip value
  } else if (arg === "--pipeline" || arg === "-p") {
    options.pipeline = args[i + 1];
    i++; // skip value
  } else if (arg === "--help" || arg === "-h") {
    console.log(`Usage: recs tui [options] [inputfile]

Options:
  --session, -s <id>     Resume a saved session
  --pipeline, -p <cmd>   Start with an initial pipeline command
  --list                 List saved sessions
  --clean                Remove sessions older than 7 days
  --help, -h             Show this help message

Examples:
  recs tui data.jsonl
  recs tui access.log --pipeline "fromre '^(\\S+)' | grep status=200"
  recs tui --session abc123
  recs tui`);
    process.exit(0);
  } else if (!arg.startsWith("-")) {
    // Positional arg = input file
    options.inputFile = arg;
  }
}

await launchTui(options);
