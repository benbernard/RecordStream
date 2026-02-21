/**
 * CI script that validates every operation exports a complete `documentation`
 * object satisfying the CommandDoc interface.
 *
 * Usage: bun scripts/check-docs.ts
 * Exit code 0 = all good, non-zero = failures found.
 */

import type { CommandDoc } from "../src/types/CommandDoc.ts";
import { readdirSync } from "node:fs";
import { join, basename } from "node:path";

interface Issue {
  file: string;
  problems: string[];
}

const OPS_ROOT = join(import.meta.dir, "..", "src", "operations");

const CATEGORIES = ["input", "transform", "output"] as const;

async function main(): Promise<void> {
  const issues: Issue[] = [];
  let total = 0;
  let passed = 0;

  for (const category of CATEGORIES) {
    const dir = join(OPS_ROOT, category);
    let files: string[];
    try {
      files = readdirSync(dir).filter(
        (f) => f.endsWith(".ts") && f !== "index.ts"
      );
    } catch {
      issues.push({ file: dir, problems: [`Directory not found: ${dir}`] });
      continue;
    }

    for (const file of files) {
      total++;
      const filePath = join(dir, file);
      const modulePath = join(OPS_ROOT, category, file);

      let mod: Record<string, unknown>;
      try {
        mod = (await import(modulePath)) as Record<string, unknown>;
      } catch (err) {
        issues.push({
          file: filePath,
          problems: [`Failed to import: ${(err as Error).message}`],
        });
        continue;
      }

      const doc = mod["documentation"] as CommandDoc | undefined;
      if (!doc) {
        issues.push({
          file: filePath,
          problems: ["Missing `export const documentation: CommandDoc` export"],
        });
        continue;
      }

      const problems = validateDoc(doc, basename(file, ".ts"), category);
      if (problems.length > 0) {
        issues.push({ file: filePath, problems });
      } else {
        passed++;
      }
    }
  }

  // Report
  console.log(`\nDocumentation check: ${passed}/${total} operations pass\n`);

  if (issues.length > 0) {
    console.log("FAILURES:\n");
    for (const issue of issues) {
      console.log(`  ${issue.file}`);
      for (const problem of issue.problems) {
        console.log(`    - ${problem}`);
      }
      console.log();
    }
    process.exit(1);
  }

  console.log("All operations have complete documentation.");
}

function validateDoc(
  doc: CommandDoc,
  filename: string,
  category: string
): string[] {
  const problems: string[] = [];

  if (!doc.name || typeof doc.name !== "string") {
    problems.push("Missing or invalid `name`");
  }

  if (!doc.category || !["input", "transform", "output"].includes(doc.category)) {
    problems.push(`Missing or invalid \`category\` (got: ${String(doc.category)})`);
  } else if (doc.category !== category) {
    problems.push(
      `Category mismatch: doc says "${doc.category}" but file is in "${category}/"`
    );
  }

  if (!doc.synopsis || typeof doc.synopsis !== "string") {
    problems.push("Missing or invalid `synopsis`");
  }

  if (!doc.description || typeof doc.description !== "string") {
    problems.push("Missing or invalid `description`");
  } else if (doc.description.length < 20) {
    problems.push(
      `Description is too short (${doc.description.length} chars, minimum 20)`
    );
  }

  if (!Array.isArray(doc.options)) {
    problems.push("Missing `options` array");
  }

  if (!Array.isArray(doc.examples)) {
    problems.push("Missing `examples` array");
  } else if (doc.examples.length < 1) {
    problems.push("At least 1 example is required");
  } else {
    for (let i = 0; i < doc.examples.length; i++) {
      const ex = doc.examples[i]!;
      if (!ex.description) {
        problems.push(`Example ${i}: missing \`description\``);
      }
      if (!ex.command) {
        problems.push(`Example ${i}: missing \`command\``);
      }
    }
  }

  return problems;
}

main();
