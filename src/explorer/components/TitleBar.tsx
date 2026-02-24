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

  return (
    <Box height={1} flexDirection="row" justifyContent="space-between" width="100%">
      <Text>
        <Text color={theme.mauve} bold>recs explorer</Text>
        {state.sessionName ? <Text color={theme.peach}> — {state.sessionName}</Text> : ""}
      </Text>
      <Text>
        <Text color={theme.overlay0}>input:</Text>
        <Text color={theme.blue}>{inputLabel}</Text>
        {countStr ? <Text color={theme.teal}>{countStr}</Text> : ""}
        <Text color={theme.overlay0}>   fork:</Text>
        <Text color={theme.green}>{forkLabel}</Text>
        <Text color={theme.overlay0}>   </Text>
        <Text color={theme.lavender}>[?]</Text>
      </Text>
    </Box>
  );
});
