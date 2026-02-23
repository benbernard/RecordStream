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
  const keys =
    state.focusedPanel === "pipeline"
      ? "a:add d:del e:edit S:save f:fork b:forks i:input x:export u:undo ?:help q:quit"
      : "↑↓:scroll t:view Tab:back";

  // Build undo/redo status string
  let undoLabel = `undo:${undoRedo?.undoCount ?? state.undoStack.length}`;
  if (undoRedo?.canRedo) {
    undoLabel += ` redo:${undoRedo.redoCount}`;
  }

  return (
    <Box height={1} flexDirection="row" justifyContent="space-between" width="100%">
      <Text color={errorMsg && !statusMessage ? theme.red : theme.text}>
        {statusMessage
          ? statusMessage
          : errorMsg
            ? `Error: ${errorMsg}`
            : keys}
      </Text>
      <Text color={theme.overlay0}>{undoLabel}</Text>
    </Box>
  );
});
