import { memo } from "react";
import { Box, Text } from "ink";
import type { PipelineState } from "../model/types.ts";
import { theme } from "../theme.ts";

export interface TitleBarProps {
  state: PipelineState;
}

export const TitleBar = memo(function TitleBar({ state }: TitleBarProps) {
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

  const titleLabel = state.sessionName ? `recs explorer — ${state.sessionName}` : "recs explorer";

  return (
    <Box height={1} flexDirection="row" justifyContent="space-between" width="100%">
      <Text color={theme.text}>{titleLabel}</Text>
      <Text color={theme.subtext0}>
        input: {inputLabel}{countStr}   fork: {forkLabel}   [?]
      </Text>
    </Box>
  );
});
