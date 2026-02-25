/**
 * CI/lint script that ensures no TypeScript visibility modifiers (private,
 * protected, public) or JavaScript private class fields (#) appear in the
 * codebase.
 *
 * Usage: bun scripts/check-no-private.ts
 * Exit code 0 = all good, non-zero = violations found.
 */

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SCAN_DIRS = [
  join(ROOT, "src"),
  join(ROOT, "tests"),
];

const EXTENSIONS = new Set([".ts", ".tsx"]);

/**
 * Patterns to detect:
 *  1. TypeScript visibility modifiers on class members: private, protected, public
 *  2. JavaScript private class fields: #fieldName (but not hex color literals like "#FFFFFF")
 */
const VISIBILITY_RE =
  /^\s*(?:(?:static|readonly|abstract|override|async)\s+)*(?:private|protected|public)\s+/;
const PRIVATE_FIELD_RE = /(?:this\.#\w|^\s*#\w+[\s:;(=])/;

interface Violation {
  file: string;
  line: number;
  text: string;
  kind: string;
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      results.push(full);
    }
  }
  return results;
}

function scan(): Violation[] {
  const violations: Violation[] = [];

  for (const dir of SCAN_DIRS) {
    for (const file of collectFiles(dir)) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        // Skip comment lines
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;

        if (VISIBILITY_RE.test(line)) {
          violations.push({
            file: relative(ROOT, file),
            line: i + 1,
            text: line.trimStart(),
            kind: "visibility modifier (private/protected/public)",
          });
        }

        if (PRIVATE_FIELD_RE.test(line)) {
          violations.push({
            file: relative(ROOT, file),
            line: i + 1,
            text: line.trimStart(),
            kind: "JS private class field (#)",
          });
        }
      }
    }
  }

  return violations;
}

const violations = scan();

if (violations.length === 0) {
  console.log("check-no-private: OK — no visibility modifiers or private fields found.");
  process.exit(0);
} else {
  console.error(
    `check-no-private: FAIL — found ${violations.length} violation(s):\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.kind}]`);
    console.error(`    ${v.text}\n`);
  }
  process.exit(1);
}
