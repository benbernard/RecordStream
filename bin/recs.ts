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
import {
  printUpdateNotice, spawnUpdateCheck, performUpdateCheck,
  selfUpdate, shouldCheck, getConfigDir, getCurrentVersion,
} from "../src/updater.ts";
import { loadAliases, setAlias, removeAlias, resolveAlias } from "../src/aliases.ts";

const args = process.argv.slice(2);
const command = args[0];
const noUpdateCheck = args.includes("--no-update-check");

// Handle internal --check-update-internal call (run in background subprocess)
if (command === "--check-update-internal") {
  await performUpdateCheck();
  process.exit(0);
}

// Handle --update (self-update)
if (command === "--update") {
  await selfUpdate();
  process.exit(0);
}

// Print update notice on startup (to stderr so it doesn't pollute pipelines)
if (!noUpdateCheck) {
  printUpdateNotice();
}

if (!command || command === "help" || command === "--help" || command === "-h") {
  const subcommand = args[1];

  if (subcommand) {
    // recs help <command>
    const doc = loadDocForCommand(subcommand);
    if (!doc) {
      console.error(`Unknown command: ${subcommand}`);
      console.error("Run 'recs help' for a list of commands.");
      process.exit(1);
    }
    console.log(docToHelpText(doc));
  } else {
    // recs help  /  recs --help  /  recs (no args)
    const docs = loadAllDocs();
    console.log(formatCommandList(docs));
  }
  process.exit(0);
}

if (command === "--version" || command === "-V") {
  console.log(`recs ${getCurrentVersion()}`);
  process.exit(0);
}

if (command === "install-manpages") {
  const { generateManPages } = await import("../scripts/generate-manpages.ts");
  const { join } = await import("node:path");
  const { homedir } = await import("node:os");
  const manDir = join(homedir(), ".local", "share", "man", "man1");
  const count = await generateManPages(manDir);
  console.log(`Installed ${count} man pages to ${manDir}`);

  const manpath = process.env["MANPATH"] ?? "";
  const manParent = join(homedir(), ".local", "share", "man");
  if (!manpath.includes(manParent)) {
    console.log(`\nHint: add ${manParent} to your MANPATH:`);
    console.log(`  export MANPATH="${manParent}:\$MANPATH"`);
  }
  process.exit(0);
}

if (command === "--list" || command === "-l" || command === "list") {
  const docs = loadAllDocs();
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

// Handle Explorer subcommand
if (command === "explorer") {
  const explorerArgs = args.slice(1);
  // Dynamically import the explorer entry point so it works in compiled binaries
  const explorerModule = await import("../src/explorer/index.tsx");
  const launchExplorer = explorerModule.launchExplorer;
  type ExplorerOptions = import("../src/explorer/index.tsx").ExplorerOptions;
  const { SessionManager } = await import("../src/explorer/session/session-manager.ts");

  const sessionManager = new SessionManager();

  // Handle --list
  if (explorerArgs.includes("--list")) {
    const sessions = await sessionManager.list();
    if (sessions.length === 0) {
      console.log("No saved sessions.");
    } else {
      console.log("Saved sessions:\n");
      for (const s of sessions) {
        const label = s.name || s.sessionId;
        console.log(`  ${label}`);
        console.log(`    ${s.stageCount} stages, last used ${formatAge(Date.now() - s.lastAccessedAt)}`);
        console.log();
      }
    }
    process.exit(0);
  }

  // Handle --clean
  if (explorerArgs.includes("--clean")) {
    const removed = await sessionManager.clean();
    console.log(removed === 0
      ? "No sessions to clean up."
      : `Removed ${removed} session${removed === 1 ? "" : "s"} older than 7 days.`);
    process.exit(0);
  }

  // Parse explorer options
  const explorerOptions: ExplorerOptions = {};
  for (let i = 0; i < explorerArgs.length; i++) {
    const arg = explorerArgs[i]!;
    if (arg === "--session" || arg === "-s") {
      explorerOptions.sessionId = explorerArgs[++i];
    } else if (arg === "--pipeline" || arg === "-p") {
      explorerOptions.pipeline = explorerArgs[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: recs explorer [options] [inputfile]

Options:
  --session, -s <id>     Resume a saved session
  --pipeline, -p <cmd>   Start with an initial pipeline command
  --list                 List saved sessions
  --clean                Remove sessions older than 7 days

Supported file types: .csv, .tsv, .xml, .jsonl, .json, .ndjson`);
      process.exit(0);
    } else if (!arg.startsWith("-")) {
      explorerOptions.inputFile = arg;
    }
  }

  try {
    await launchExplorer(explorerOptions);
  } catch (err) {
    process.stderr.write(
      `\nExplorer error: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(err.stack + "\n");
    }
    process.exit(1);
  }
  process.exit(0);
}

// Handle alias management subcommand
if (command === "alias") {
  const aliasArgs = args.slice(1);

  // recs alias --remove <name>  /  recs alias -r <name>
  if (aliasArgs[0] === "--remove" || aliasArgs[0] === "-r") {
    const name = aliasArgs[1];
    if (!name) {
      console.error("Usage: recs alias --remove <name>");
      process.exit(1);
    }
    if (removeAlias(name)) {
      console.log(`Removed alias: ${name}`);
    } else {
      console.error(`Alias not found: ${name}`);
      process.exit(1);
    }
    process.exit(0);
  }

  // recs alias (no args) — list all
  if (aliasArgs.length === 0) {
    const aliases = loadAliases();
    const names = Object.keys(aliases).sort();
    if (names.length === 0) {
      console.log("No aliases defined.");
      console.log("Use 'recs alias <name> <command> [args...]' to create one.");
    } else {
      for (const name of names) {
        console.log(`${name} = ${aliases[name]!.join(" ")}`);
      }
    }
    process.exit(0);
  }

  // recs alias <name> (show single alias)
  if (aliasArgs.length === 1) {
    const aliases = loadAliases();
    const expansion = aliases[aliasArgs[0]!];
    if (expansion) {
      console.log(`${aliasArgs[0]} = ${expansion.join(" ")}`);
    } else {
      console.error(`Alias not found: ${aliasArgs[0]}`);
      process.exit(1);
    }
    process.exit(0);
  }

  // recs alias <name> <command> [args...] — set alias
  const name = aliasArgs[0]!;
  const expansion = aliasArgs.slice(1);
  setAlias(name, expansion);
  console.log(`${name} = ${expansion.join(" ")}`);
  process.exit(0);
}

// Resolve aliases before dispatch
let resolvedCommand = command!;
let restArgs = args.slice(1);

const aliasResult = resolveAlias(resolvedCommand, restArgs);
if (aliasResult) {
  resolvedCommand = aliasResult.command;
  restArgs = aliasResult.args;
}

// Dispatch to the operation.
// If remaining args contain a bare "|", treat the whole invocation as an implicit chain.
// e.g. `recs grep "..." \| collate --key foo` becomes `recs chain grep "..." | collate --key foo`
const hasImplicitChain = resolvedCommand !== "chain" && restArgs.includes("|");
const exitCode = hasImplicitChain
  ? await runOperation("chain", [resolvedCommand, ...restArgs])
  : await runOperation(resolvedCommand, restArgs);

// Spawn background update check if due (detached, non-blocking)
if (!noUpdateCheck && shouldCheck(getConfigDir())) {
  spawnUpdateCheck();
}

process.exit(exitCode);

function formatAge(ms: number): string {
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}
