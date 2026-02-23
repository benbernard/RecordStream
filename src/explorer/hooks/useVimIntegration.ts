/**
 * useVimIntegration — Open inspector records in $EDITOR.
 *
 * When triggered, writes the current inspector records to a temp file
 * as JSON lines, spawns $EDITOR (defaults to vim), suspends the TUI
 * renderer during editing, then cleans up on exit.
 */

import { useCallback } from "react";
import { useApp } from "ink";
import type { Record } from "../../Record.ts";

export interface UseVimIntegrationResult {
  /** Open the given records in $EDITOR */
  openInEditor: (records: Record[]) => Promise<void>;
}

export function useVimIntegration(): UseVimIntegrationResult {
  const { exit } = useApp();

  const openInEditor = useCallback(
    async (records: Record[]) => {
      if (records.length === 0) return;

      // Write records to temp file as JSONL
      const tmpDir =
        process.env["TMPDIR"] ?? process.env["TMP"] ?? "/tmp";
      const tmpFile = `${tmpDir}/recs-explorer-${Date.now()}.jsonl`;

      const content = records.map((r) => r.toString()).join("\n") + "\n";
      await Bun.write(tmpFile, content);

      const editor = process.env["EDITOR"] ?? "vim";

      try {
        // Exit the Ink renderer so the editor can take over the terminal.
        // The user can resume via session after the editor closes.
        exit();

        const proc = Bun.spawn([editor, tmpFile], {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        });

        await proc.exited;
      } finally {
        // Clean up temp file
        try {
          const { unlinkSync } = await import("node:fs");
          unlinkSync(tmpFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    },
    [exit],
  );

  return { openInEditor };
}
