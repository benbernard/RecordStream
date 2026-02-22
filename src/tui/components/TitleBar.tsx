import type { PipelineState } from "../model/types.ts";

export interface TitleBarProps {
  state: PipelineState;
}

export function TitleBar({ state }: TitleBarProps) {
  const input = state.inputs.get(state.activeInputId);
  const inputLabel = input?.label ?? "(no input)";

  const fork = state.forks.get(state.activeForkId);
  const forkLabel = fork?.name ?? "main";

  const cachedResult = state.cursorStageId
    ? state.cache.get(`${state.activeInputId}:${state.cursorStageId}`)
    : undefined;
  const recordCount = cachedResult?.recordCount;
  const countStr =
    recordCount !== undefined ? ` (${recordCount} rec)` : "";

  return (
    <box height={1} flexDirection="row" justifyContent="space-between" width="100%">
      <text>recs tui</text>
      <text>
        input: {inputLabel}{countStr}   fork: {forkLabel}   [?]
      </text>
    </box>
  );
}
