/**
 * PipelineBar — horizontal shell-pipeline display.
 *
 * Shows the pipeline as a compact shell command string:
 *   recs fromps | grep 'x > 5' | sort --key x | **totable**
 *
 * The cursor stage is rendered bold. Disabled stages are dimmed.
 * Stages with errors are red. Clicking ↑↓ moves the cursor.
 */

import { useMemo, memo } from "react";
import { Box, Text } from "ink";
import type { PipelineState, Stage } from "../model/types.ts";
import { getActivePath, getStageOutput } from "../model/selectors.ts";
import { shellEscape } from "../model/serialization.ts";
import { allDocs } from "../../cli/operation-registry.ts";
import { theme } from "../theme.ts";

export interface PipelineBarProps {
  state: PipelineState;
}

/**
 * Format a stage as a shell command fragment with shell-escaped arguments.
 * Known recs operations get the `recs` prefix; shell commands do not.
 */
function formatStageDisplay(stage: Stage): string {
  const isRecsOp = allDocs.some((d) => d.name === stage.config.operationName);
  const parts = isRecsOp
    ? ["recs", stage.config.operationName]
    : [stage.config.operationName];
  for (const arg of stage.config.args) {
    parts.push(shellEscape(arg));
  }
  return parts.join(" ");
}

export const PipelineBar = memo(function PipelineBar({ state }: PipelineBarProps) {
  const stages = useMemo(
    () => getActivePath(state),
    [state.stages, state.forks, state.activeForkId],
  );
  const isFocused = state.focusedPanel === "pipeline";

  if (stages.length === 0) {
    return (
      <Box
        borderStyle="single"
        borderColor={isFocused ? theme.lavender : theme.surface1}
        paddingX={1}
      >
        <Text color={theme.overlay0}>(empty pipeline — press </Text>
        <Text color={theme.lavender}>a</Text>
        <Text color={theme.overlay0}> to add a stage)</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="row"
      borderStyle="single"
      borderColor={isFocused ? theme.lavender : theme.surface1}
      paddingX={1}
      flexWrap="wrap"
    >
      {stages.map((stage, idx) => {
        const isCursor = stage.id === state.cursorStageId;
        const isDisabled = !stage.config.enabled;
        const isError = state.lastError?.stageId === stage.id;
        const cached = getStageOutput(state, stage.id);
        const stageText = formatStageDisplay(stage);

        let color: string | undefined;
        if (isError) {
          color = theme.red;
        } else if (isDisabled) {
          color = theme.overlay0;
        } else if (isCursor) {
          color = theme.lavender;
        } else {
          color = theme.subtext0;
        }

        // Record/line count badge
        let badge = "";
        if (cached) {
          if (cached.records.length === 0 && cached.lines.length > 0) {
            badge = ` [${cached.lines.length}☰]`;
          } else {
            badge = ` [${cached.recordCount}]`;
          }
        }

        return (
          <Text key={stage.id}>
            {idx > 0 && <Text color={theme.mauve}> | </Text>}
            <Text
              bold={isCursor}
              color={color}
              underline={isCursor && isFocused}
              strikethrough={isDisabled}
            >
              {stageText}
            </Text>
            {badge && (
              <Text color={theme.teal}>{badge}</Text>
            )}
          </Text>
        );
      })}
    </Box>
  );
});
