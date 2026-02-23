import type { PipelineState } from "../model/types.ts";

export interface StatusBarProps {
  state: PipelineState;
  statusMessage?: string | null;
}

export function StatusBar({ state, statusMessage }: StatusBarProps) {
  const undoCount = state.undoStack.length;
  const errorMsg = state.lastError?.message;

  // Context-sensitive keybindings based on focused panel
  const keys =
    state.focusedPanel === "pipeline"
      ? "a:add d:del e:edit J/K:move x:export v:vim u:undo ?:help q:quit"
      : "↑↓:scroll t:view /:search Tab:back";

  return (
    <box height={1} flexDirection="row" justifyContent="space-between" width="100%">
      <text>
        {statusMessage
          ? statusMessage
          : errorMsg
            ? `Error: ${errorMsg}`
            : keys}
      </text>
      <text fg="#888888">undo:{undoCount}</text>
    </box>
  );
}
