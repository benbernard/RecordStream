/**
 * Plugin/extension system for RecordStream.
 *
 * Scans a user-configured plugin directory for additional operations and
 * registers them. Users set `RECS_PLUGIN_DIR` to point at a directory
 * containing `.ts` or `.js` files that export:
 *
 *   - A default or named `operation` class extending Operation
 *   - A `documentation` object matching CommandDoc
 *   - A `factory` function `(next: RecordReceiver) => Operation`
 *
 * Discovered operations are registered into the operation factory so they
 * can be used by `chain` and eventually by the CLI dispatcher.
 *
 * Analogous to App::RecordStream::Site in Perl.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { registerOperationFactory } from "./operations/transform/chain.ts";
import type { CommandDoc } from "./types/CommandDoc.ts";
import type { Operation, RecordReceiver } from "./Operation.ts";

interface PluginModule {
  documentation?: CommandDoc;
  factory?: (next: RecordReceiver) => Operation;
  default?: new (next?: RecordReceiver) => Operation;
}

interface LoadedPlugin {
  name: string;
  documentation: CommandDoc | undefined;
}

/**
 * Load plugins from the directory specified by `RECS_PLUGIN_DIR`.
 *
 * Returns the list of successfully loaded plugins. If the env var is
 * unset or the directory doesn't exist, returns an empty array.
 */
export async function loadPlugins(): Promise<LoadedPlugin[]> {
  const pluginDir = process.env["RECS_PLUGIN_DIR"];
  if (!pluginDir) return [];
  if (!existsSync(pluginDir)) return [];

  const entries = readdirSync(pluginDir).filter(
    (f) => f.endsWith(".ts") || f.endsWith(".js")
  );

  const loaded: LoadedPlugin[] = [];

  for (const entry of entries) {
    const fullPath = join(pluginDir, entry);
    const name = entry.replace(/\.(ts|js)$/, "");

    const mod = (await import(fullPath)) as PluginModule;

    // Prefer an explicit factory; fall back to default-exported constructor
    if (mod.factory) {
      registerOperationFactory(name, mod.factory);
    } else if (mod.default) {
      const Ctor = mod.default;
      registerOperationFactory(name, (next: RecordReceiver) => new Ctor(next));
    } else {
      // Skip files that don't export a factory or default operation
      continue;
    }

    loaded.push({
      name,
      documentation: mod.documentation,
    });
  }

  return loaded;
}
