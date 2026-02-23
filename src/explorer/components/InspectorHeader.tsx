import { memo } from "react";
import { Box, Text } from "ink";
import type { PipelineState } from "../model/types.ts";
import { getCursorStage, getCursorOutput, getActivePath, getStageOutput } from "../model/selectors.ts";
import { theme } from "../theme.ts";

export interface InspectorHeaderProps {
  state: PipelineState;
}

function formatCacheAge(computedAt: number): string {
  const elapsed = Date.now() - computedAt;
  if (elapsed < 1000) return "just now";
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  return `${Math.floor(elapsed / 3_600_000)}h ago`;
}

export const InspectorHeader = memo(function InspectorHeader({ state }: InspectorHeaderProps) {
  const stage = getCursorStage(state);
  const output = getCursorOutput(state);

  if (!stage) {
    return (
      <Box height={1}>
        <Text color={theme.overlay0}>Inspector: (select a stage)</Text>
      </Box>
    );
  }

  if (state.executing) {
    return (
      <Box height={1}>
        <Text color={theme.yellow}>Inspector: {stage.config.operationName} (computing...)</Text>
      </Box>
    );
  }

  if (state.lastError?.stageId === stage.id) {
    return (
      <Box height={1}>
        <Text color={theme.red}>Inspector: {stage.config.operationName} — ERROR</Text>
      </Box>
    );
  }

  // Get total record count from first stage for ratio display
  const activePath = getActivePath(state);
  const firstStage = activePath[0];
  const firstOutput = firstStage ? getStageOutput(state, firstStage.id) : undefined;
  const totalRecords = firstOutput?.recordCount;

  let countStr: string;
  if (!output) {
    countStr = "not cached";
  } else if (totalRecords && totalRecords > 0 && output.recordCount !== totalRecords) {
    const pct = Math.round((output.recordCount / totalRecords) * 100);
    countStr = `${output.recordCount} of ${totalRecords} records (${pct}%)`;
  } else {
    countStr = `${output.recordCount} records`;
  }
  const cacheAge = output ? `, cached ${formatCacheAge(output.computedAt)}` : "";

  return (
    <Box height={1}>
      <Text color={theme.text}>
        Inspector: {stage.config.operationName} ({countStr}{cacheAge})
      </Text>
    </Box>
  );
});
