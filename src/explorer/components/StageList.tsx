import { useMemo, memo } from "react";
import { Box, Text } from "ink";
import type { PipelineState, PipelineAction } from "../model/types.ts";
import { getActivePath } from "../model/selectors.ts";
import { StageRow } from "./StageRow.tsx";
import { theme } from "../theme.ts";

export interface StageListProps {
  state: PipelineState;
  dispatch: (action: PipelineAction) => void;
}

export const StageList = memo(function StageList({ state }: StageListProps) {
  const stages = useMemo(
    () => getActivePath(state),
    [state.stages, state.forks, state.activeForkId],
  );
  const isFocused = state.focusedPanel === "pipeline";

  return (
    <Box
      width={32}
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? theme.text : theme.surface1}
    >
      <Text color={theme.overlay0}>Pipeline</Text>
      {stages.length === 0 ? (
        <Text color={theme.surface1}>  (empty — press a to add)</Text>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          {stages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              state={state}
              isCursor={stage.id === state.cursorStageId}
            />
          ))}
        </Box>
      )}
    </Box>
  );
});
