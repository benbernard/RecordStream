import { memo } from "react";
import { Box, Text } from "ink";
import type { PipelineState } from "../model/types.ts";
import { getCursorStage, getCursorOutput } from "../model/selectors.ts";
import { InspectorHeader } from "./InspectorHeader.tsx";
import { RecordView } from "./RecordView.tsx";
import { theme } from "../theme.ts";

export interface InspectorPanelProps {
  state: PipelineState;
}

export const InspectorPanel = memo(function InspectorPanel({ state }: InspectorPanelProps) {
  const isFocused = state.focusedPanel === "inspector";
  const stage = getCursorStage(state);
  const output = getCursorOutput(state);

  return (
    <Box
      flexGrow={1}
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? theme.blue : theme.surface1}
    >
      <InspectorHeader state={state} />

      <Box flexDirection="column" flexGrow={1}>
        {!stage ? (
          <Text color={theme.overlay0}>Select a stage to inspect its output</Text>
        ) : state.executing ? (
          <Text color={theme.yellow}>Computing...</Text>
        ) : state.lastError?.stageId === stage.id ? (
          <Box flexDirection="column">
            <Text color={theme.red}>Error: {state.lastError.message}</Text>
          </Box>
        ) : !output ? (
          <Text>
            <Text color={theme.overlay0}>No cached output. Press </Text>
            <Text color={theme.lavender}>r</Text>
            <Text color={theme.overlay0}> to execute.</Text>
          </Text>
        ) : (
          <RecordView
            result={output}
            viewMode={state.inspector.viewMode}
            scrollOffset={state.inspector.scrollOffset}
            highlightedColumn={state.inspector.highlightedColumn}
          />
        )}
      </Box>
    </Box>
  );
});
