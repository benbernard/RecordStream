import { memo } from "react";
import { Box, Text } from "ink";
import type { PipelineState } from "../model/types.ts";
import type { UseUndoRedoResult } from "../hooks/useUndoRedo.ts";
import { theme } from "../theme.ts";

export interface StatusBarProps {
  state: PipelineState;
  statusMessage?: string | null;
  undoRedo?: UseUndoRedoResult;
}

export const StatusBar = memo(function StatusBar({ state, statusMessage, undoRedo }: StatusBarProps) {
  const errorMsg = state.lastError?.message;

  // Context-sensitive keybindings based on focused panel
  const keyDefs: Array<[string, string]> =
    state.focusedPanel === "pipeline"
      ? [["a","add"],["d","del"],["e","edit"],["S","save"],["f","fork"],["b","forks"],["i","input"],["x","export"],["u","undo"],["?","help"],["q","quit"]]
      : [["↑↓","scroll"],["t","view"],["Tab","back"]];

  // Build undo/redo counts
  const undoCount = undoRedo?.undoCount ?? state.undoStack.length;
  const redoCount = undoRedo?.redoCount ?? 0;
  const canRedo = undoRedo?.canRedo ?? false;

  return (
    <Box height={1} flexDirection="row" justifyContent="space-between" width="100%">
      {statusMessage ? (
        <Text color={theme.green}>{statusMessage}</Text>
      ) : errorMsg ? (
        <Text color={theme.red}>Error: {errorMsg}</Text>
      ) : (
        <Text>
          {keyDefs.map(([key, label], i) => (
            <Text key={i}>
              {i > 0 && <Text color={theme.surface1}> </Text>}
              <Text color={theme.lavender}>{key}</Text>
              <Text color={theme.overlay0}>:</Text>
              <Text color={theme.subtext0}>{label}</Text>
            </Text>
          ))}
        </Text>
      )}
      <Text>
        <Text color={theme.overlay0}>undo:</Text>
        <Text color={theme.teal}>{undoCount}</Text>
        {canRedo && (
          <>
            <Text color={theme.overlay0}> redo:</Text>
            <Text color={theme.teal}>{redoCount}</Text>
          </>
        )}
      </Text>
    </Box>
  );
});
