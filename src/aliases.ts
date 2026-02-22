/**
 * User-configurable command aliases.
 *
 * Aliases are stored in $XDG_CONFIG_HOME/recs/aliases.json (default
 * ~/.config/recs/aliases.json). Each alias maps a short name to an
 * expansion array where [0] is the real command and the rest are
 * prepended arguments.
 *
 * Example aliases.json:
 *   { "pp": ["toprettyprint"], "csv": ["fromcsv", "--header"] }
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureConfigDir, getConfigDir } from "./updater.ts";

export type AliasMap = { [name: string]: string[] };

/**
 * Path to the aliases.json file inside the config directory.
 */
export function getAliasesPath(configDir?: string): string {
  return join(configDir ?? getConfigDir(), "aliases.json");
}

/**
 * Load all aliases from disk. Returns an empty map if the file
 * doesn't exist or can't be parsed.
 */
export function loadAliases(configDir?: string): AliasMap {
  const path = getAliasesPath(configDir);
  try {
    if (!existsSync(path)) return {};
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    // Validate that every value is a non-empty string array
    const result: AliasMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((v) => typeof v === "string")
      ) {
        result[key] = value as string[];
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Save the full alias map to disk, creating the config directory
 * if needed.
 */
export function saveAliases(aliases: AliasMap, configDir?: string): void {
  const dir = configDir ?? ensureConfigDir();
  const path = getAliasesPath(dir);
  writeFileSync(path, JSON.stringify(aliases, null, 2) + "\n", "utf-8");
}

/**
 * Get a single alias expansion. Returns undefined if not found.
 */
export function getAlias(name: string, configDir?: string): string[] | undefined {
  const aliases = loadAliases(configDir);
  return aliases[name];
}

/**
 * Set (create or overwrite) an alias.
 */
export function setAlias(name: string, expansion: string[], configDir?: string): void {
  const dir = configDir ?? ensureConfigDir();
  const aliases = loadAliases(dir);
  aliases[name] = expansion;
  saveAliases(aliases, dir);
}

/**
 * Remove an alias. Returns true if it existed and was removed.
 */
export function removeAlias(name: string, configDir?: string): boolean {
  const dir = configDir ?? ensureConfigDir();
  const aliases = loadAliases(dir);
  if (!(name in aliases)) return false;
  delete aliases[name];
  saveAliases(aliases, dir);
  return true;
}

/**
 * Resolve a command through aliases. If `command` is an alias, returns
 * the expanded [command, ...prependedArgs, ...restArgs]. Otherwise
 * returns null (meaning: not an alias, use the original command).
 *
 * Prevents infinite alias loops by tracking seen names.
 */
export function resolveAlias(
  command: string,
  restArgs: string[],
  configDir?: string,
): { command: string; args: string[] } | null {
  const aliases = loadAliases(configDir);
  const seen = new Set<string>();
  let current = command;

  while (current in aliases) {
    if (seen.has(current)) {
      process.stderr.write(`Alias loop detected: ${current}\n`);
      return null;
    }
    seen.add(current);
    const expansion = aliases[current]!;
    current = expansion[0]!;
    restArgs = [...expansion.slice(1), ...restArgs];
  }

  if (current === command) return null; // no alias matched
  return { command: current, args: restArgs };
}
