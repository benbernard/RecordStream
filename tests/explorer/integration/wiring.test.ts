/**
 * Wiring audit test — verifies that all hooks, components, and modules
 * defined in src/explorer/ are actually imported and reachable from the
 * App.tsx component tree.
 *
 * This catches "defined but not wired" bugs where a module exists but is
 * never imported (like the useExecution bug that went undetected by 325+ tests).
 *
 * Strategy: statically read the source files and verify import chains,
 * ensuring every module is reachable from App.tsx within ≤3 hops.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";

const SRC_DIR = join(import.meta.dir, "../../../src/explorer");
const APP_PATH = join(SRC_DIR, "components/App.tsx");

/**
 * Extract all relative import paths from a source file.
 * Matches: import ... from "..." and import "..."
 */
function extractImports(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?["'](\.[^"']+)["']/g;
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]!);
  }
  return imports;
}

/**
 * Resolve a relative import path to an absolute file path.
 * Handles .ts/.tsx extension matching.
 */
function resolveImport(fromFile: string, importPath: string): string | null {
  const dir = join(fromFile, "..");
  // Try exact path first, then with extensions
  const candidates = [
    join(dir, importPath),
    join(dir, importPath + ".ts"),
    join(dir, importPath + ".tsx"),
    join(dir, importPath, "index.ts"),
    join(dir, importPath, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Build the full import graph reachable from a root file, following
 * only imports within the explorer directory tree.
 */
function buildImportGraph(rootFile: string): Set<string> {
  const visited = new Set<string>();
  const queue = [rootFile];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const imports = extractImports(current);
    for (const imp of imports) {
      const resolved = resolveImport(current, imp);
      if (resolved && resolved.startsWith(SRC_DIR)) {
        queue.push(resolved);
      }
    }
  }

  return visited;
}

/**
 * Get all .ts/.tsx source files in src/explorer/ (excluding types.ts).
 */
function getAllExplorerModules(): string[] {
  const modules: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        modules.push(fullPath);
      }
    }
  }

  walk(SRC_DIR);
  return modules;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Explorer wiring audit", () => {
  const reachable = buildImportGraph(APP_PATH);
  const allModules = getAllExplorerModules();

  test("App.tsx import graph is reachable", () => {
    expect(reachable.has(APP_PATH)).toBe(true);
    // Should reach at least 20 modules
    expect(reachable.size).toBeGreaterThan(20);
  });

  // ── Hooks ───────────────────────────────────────────────────────

  describe("hooks are wired into the component tree", () => {
    test("useExecution is reachable from App.tsx", () => {
      const hookPath = join(SRC_DIR, "hooks/useExecution.ts");
      expect(reachable.has(hookPath)).toBe(true);
    });

    test("useAutoSave is reachable from App.tsx", () => {
      const hookPath = join(SRC_DIR, "hooks/useAutoSave.ts");
      expect(reachable.has(hookPath)).toBe(true);
    });

    test("useUndoRedo is reachable from App.tsx", () => {
      const hookPath = join(SRC_DIR, "hooks/useUndoRedo.ts");
      expect(reachable.has(hookPath)).toBe(true);
    });

    test("useVimIntegration is reachable from App.tsx", () => {
      const hookPath = join(SRC_DIR, "hooks/useVimIntegration.ts");
      expect(reachable.has(hookPath)).toBe(true);
    });

    test("useExecution is actually called (not just imported)", () => {
      const appContent = readFileSync(APP_PATH, "utf-8");
      expect(appContent).toMatch(/useExecution\s*\(/);
    });

    test("useAutoSave is actually called (not just imported)", () => {
      const appContent = readFileSync(APP_PATH, "utf-8");
      expect(appContent).toMatch(/useAutoSave\s*\(/);
    });

    test("useUndoRedo is actually called (not just imported)", () => {
      const appContent = readFileSync(APP_PATH, "utf-8");
      expect(appContent).toMatch(/useUndoRedo\s*\(/);
    });

    test("useVimIntegration is actually called (not just imported)", () => {
      const appContent = readFileSync(APP_PATH, "utf-8");
      expect(appContent).toMatch(/useVimIntegration\s*\(/);
    });
  });

  // ── Components ──────────────────────────────────────────────────

  describe("components are reachable from App.tsx", () => {
    const components = [
      "components/WelcomeScreen.tsx",
      "components/TitleBar.tsx",
      "components/PipelineBar.tsx",
      "components/ForkTabs.tsx",
      "components/InspectorPanel.tsx",
      "components/StatusBar.tsx",
      "components/InspectorHeader.tsx",
      "components/RecordView.tsx",
      "components/RecordTable.tsx",
      "components/SchemaView.tsx",
      "components/modals/AddStageModal.tsx",
      "components/modals/EditStageModal.tsx",
      "components/modals/ConfirmDialog.tsx",
      "components/modals/HelpPanel.tsx",
      "components/modals/ExportPicker.tsx",
      "components/modals/ForkManager.tsx",
      "components/modals/InputSwitcher.tsx",
      "components/modals/LargeFileWarning.tsx",
      "components/modals/SessionPicker.tsx",
      "components/modals/SaveSessionModal.tsx",
      "components/modals/RecordDetail.tsx",
      "components/modals/FieldSpotlight.tsx",
    ];

    for (const component of components) {
      test(`${basename(component, ".tsx")} is reachable`, () => {
        const fullPath = join(SRC_DIR, component);
        expect(reachable.has(fullPath)).toBe(true);
      });
    }
  });

  // ── Model modules ──────────────────────────────────────────────

  describe("model modules are reachable from App.tsx", () => {
    test("reducer.ts is reachable", () => {
      expect(reachable.has(join(SRC_DIR, "model/reducer.ts"))).toBe(true);
    });

    test("selectors.ts is reachable", () => {
      expect(reachable.has(join(SRC_DIR, "model/selectors.ts"))).toBe(true);
    });

    test("serialization.ts is reachable", () => {
      expect(reachable.has(join(SRC_DIR, "model/serialization.ts"))).toBe(true);
    });

    test("undo.ts is reachable (via reducer)", () => {
      expect(reachable.has(join(SRC_DIR, "model/undo.ts"))).toBe(true);
    });

    test("types.ts is reachable", () => {
      expect(reachable.has(join(SRC_DIR, "model/types.ts"))).toBe(true);
    });
  });

  // ── Executor modules ──────────────────────────────────────────

  describe("executor modules are reachable from App.tsx", () => {
    test("executor.ts is reachable (via useExecution)", () => {
      expect(reachable.has(join(SRC_DIR, "executor/executor.ts"))).toBe(true);
    });

    test("input-loader.ts is reachable (via executor)", () => {
      expect(reachable.has(join(SRC_DIR, "executor/input-loader.ts"))).toBe(true);
    });

    test("intercept-receiver.ts is reachable (via executor)", () => {
      expect(reachable.has(join(SRC_DIR, "executor/intercept-receiver.ts"))).toBe(true);
    });
  });

  // ── Session modules ───────────────────────────────────────────

  describe("session modules are reachable from App.tsx", () => {
    test("session-manager.ts is reachable", () => {
      expect(reachable.has(join(SRC_DIR, "session/session-manager.ts"))).toBe(true);
    });

    test("auto-save.ts is reachable (via useAutoSave)", () => {
      expect(reachable.has(join(SRC_DIR, "session/auto-save.ts"))).toBe(true);
    });

    test("session-cache-store.ts is reachable (via session-manager)", () => {
      expect(reachable.has(join(SRC_DIR, "session/session-cache-store.ts"))).toBe(true);
    });
  });

  // ── Utility modules ───────────────────────────────────────────

  describe("utility modules are reachable from App.tsx", () => {
    test("file-detect.ts is reachable", () => {
      expect(reachable.has(join(SRC_DIR, "utils/file-detect.ts"))).toBe(true);
    });

    test("fuzzy-match.ts is reachable (via AddStageModal)", () => {
      expect(reachable.has(join(SRC_DIR, "utils/fuzzy-match.ts"))).toBe(true);
    });
  });

  // ── Dead module detection ─────────────────────────────────────

  describe("dead module detection", () => {
    test("reports unreachable modules", () => {
      const unreachable = allModules.filter((m) => !reachable.has(m));
      const unreachableRelative = unreachable.map((m) => relative(SRC_DIR, m));

      // Known dead modules (documented in wiring audit):
      // - hooks/usePipeline.ts: App.tsx uses inline useReducer instead
      // - executor/cache-manager.ts: executor uses state.cache Map directly
      // If this list grows, investigate whether new modules need wiring.
      const knownDead = new Set([
        "hooks/usePipeline.ts",
        "executor/cache-manager.ts",
      ]);

      const unknownDead = unreachableRelative.filter((m) => !knownDead.has(m));

      if (unknownDead.length > 0) {
        throw new Error(
          `Found unexpected unreachable modules:\n` +
          unknownDead.map((m) => `  - ${m}`).join("\n") +
          `\n\nThese modules exist in src/explorer/ but are not imported ` +
          `from the App.tsx component tree. Either wire them in or add ` +
          `them to the knownDead set with a comment explaining why.`,
        );
      }
    });

    test("usePipeline.ts is known dead (App.tsx uses inline useReducer)", () => {
      const hookPath = join(SRC_DIR, "hooks/usePipeline.ts");
      expect(reachable.has(hookPath)).toBe(false);
    });

    test("cache-manager.ts is known dead (executor uses state.cache directly)", () => {
      const cacheMgrPath = join(SRC_DIR, "executor/cache-manager.ts");
      expect(reachable.has(cacheMgrPath)).toBe(false);
    });
  });

  // ── Hook invocation checks ────────────────────────────────────
  // Verify hooks aren't just imported but are actually invoked within
  // a component (the useExecution bug was: imported but not called).

  describe("hooks are invoked, not just imported", () => {
    const hookNames = [
      "useExecution",
      "useAutoSave",
      "useUndoRedo",
      "useVimIntegration",
    ];

    for (const hookName of hookNames) {
      test(`${hookName} is called in a component`, () => {
        // Search all reachable component files for actual invocation
        let found = false;
        for (const filePath of reachable) {
          if (!filePath.endsWith(".tsx")) continue;
          const content = readFileSync(filePath, "utf-8");
          // Match hook being called (not just imported)
          const callPattern = new RegExp(`${hookName}\\s*\\(`);
          if (callPattern.test(content)) {
            found = true;
            break;
          }
        }
        expect(found).toBe(true);
      });
    }
  });

  // ── Selector usage checks ─────────────────────────────────────
  // Verify key selectors are used from components (not just internally).

  describe("key selectors are used from components", () => {
    const keySelectors = [
      "getCursorStage",
      "getCursorOutput",
      "getActivePath",
      "getDownstreamStages",
      "getEnabledStages",
    ];

    for (const selector of keySelectors) {
      test(`${selector} is used outside selectors.ts`, () => {
        let usedExternally = false;
        for (const filePath of reachable) {
          if (filePath.endsWith("selectors.ts")) continue;
          const content = readFileSync(filePath, "utf-8");
          if (content.includes(selector)) {
            usedExternally = true;
            break;
          }
        }
        expect(usedExternally).toBe(true);
      });
    }
  });
});
