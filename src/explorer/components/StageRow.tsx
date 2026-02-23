import { memo } from "react";
import { Box, Text } from "ink";
import type { Stage, PipelineState, StageId, StageDelta } from "../model/types.ts";
import { isDownstreamOfError, getStageOutput, getStageDelta } from "../model/selectors.ts";
import { theme } from "../theme.ts";

export interface StageRowProps {
  stage: Stage;
  state: PipelineState;
  isCursor: boolean;
}

function getCacheIndicator(
  state: PipelineState,
  stageId: StageId,
): { text: string; color: string } {
  if (state.lastError?.stageId === stageId) return { text: "[err]", color: theme.red };
  if (state.executing && state.cursorStageId === stageId) return { text: "[run]", color: theme.blue };
  const cached = getStageOutput(state, stageId);
  if (cached) return { text: "[ok]", color: theme.green };
  return { text: "[stale]", color: theme.yellow };
}

/**
 * Format a delta summary string and its color for the stage row.
 */
function formatDelta(delta: StageDelta): { text: string; color: string | undefined } {
  const fieldSuffix = delta.fieldsAdded > 0 ? ` +${delta.fieldsAdded}◆` : "";

  if (delta.kind === "input" || delta.parentCount === null) {
    return { text: `${delta.outputCount}${fieldSuffix}`, color: undefined };
  }

  if (delta.kind === "reorder") {
    return { text: `═${delta.outputCount}${fieldSuffix}`, color: theme.overlay0 };
  }

  if (delta.kind === "filter") {
    const removed = delta.parentCount - delta.outputCount;
    if (removed > 0) {
      return {
        text: `-${removed} → ${delta.outputCount}${fieldSuffix}`,
        color: theme.red,
      };
    }
    return { text: `═${delta.outputCount}${fieldSuffix}`, color: theme.overlay0 };
  }

  if (delta.kind === "aggregate") {
    return {
      text: `▼${delta.parentCount} → ${delta.outputCount}${fieldSuffix}`,
      color: theme.yellow,
    };
  }

  // transform: show diff if count changed, otherwise just count
  if (delta.parentCount !== delta.outputCount) {
    const diff = delta.outputCount - delta.parentCount;
    const sign = diff > 0 ? "+" : "";
    return {
      text: `${sign}${diff} → ${delta.outputCount}${fieldSuffix}`,
      color: diff > 0 ? theme.green : theme.red,
    };
  }
  return { text: `${delta.outputCount}${fieldSuffix}`, color: undefined };
}

function getRecordDisplay(
  state: PipelineState,
  stageId: StageId,
): { text: string; color: string | undefined } {
  const delta = getStageDelta(state, stageId);
  if (delta) return formatDelta(delta);

  // No cached result yet
  return { text: "----", color: undefined };
}

export const StageRow = memo(function StageRow({ stage, state, isCursor }: StageRowProps) {
  const isError = state.lastError?.stageId === stage.id;
  const isDisabled = !stage.config.enabled;
  const isDownstream = isDownstreamOfError(state, stage.id);

  const cacheInd = getCacheIndicator(state, stage.id);
  const { text: countText, color: deltaColor } = getRecordDisplay(state, stage.id);
  const cursor = isCursor ? ">" : " ";

  const argsStr = stage.config.args.join(" ");
  const truncatedArgs = argsStr.length > 20 ? argsStr.slice(0, 17) + "..." : argsStr;

  // Determine fg color for the main label
  let fg: string | undefined;
  if (isError) {
    fg = theme.red;
  } else if (isDisabled || isDownstream) {
    fg = theme.overlay0;
  } else if (isCursor) {
    fg = theme.text;
  }

  // Delta color: only apply when not overridden by error/disabled states
  const countFg = isError || isDisabled || isDownstream ? fg : (deltaColor ?? fg);

  const bg = isCursor ? theme.surface0 : undefined;
  const posStr = String(stage.position + 1).padStart(3);
  const disabledMarker = isDisabled ? " [off]" : "";

  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="row" width="100%">
        <Text color={fg} backgroundColor={bg}>
          {cursor} {posStr} {stage.config.operationName}  </Text>
        <Text color={cacheInd.color} backgroundColor={bg}>
          {cacheInd.text}  </Text>
        <Text color={countFg} backgroundColor={bg}>
          {countText}</Text>
        <Text color={fg} backgroundColor={bg}>
          {disabledMarker}</Text>
      </Box>
      {truncatedArgs ? (
        <Text color={isDisabled || isDownstream ? theme.surface1 : theme.subtext0} backgroundColor={bg}>
          {"     "}{truncatedArgs}
        </Text>
      ) : null}
    </Box>
  );
}, (prev, next) => {
  // Custom comparator: only re-render when the data this row
  // actually depends on has changed.
  if (prev.stage !== next.stage) return false;
  if (prev.isCursor !== next.isCursor) return false;

  // Check state fields that affect this row's rendering
  const prevState = prev.state;
  const nextState = next.state;
  if (prevState.executing !== nextState.executing) return false;
  if (prevState.lastError !== nextState.lastError) return false;
  if (prevState.cursorStageId !== nextState.cursorStageId) return false;

  // Check if the cache entry for this stage changed
  const key = `${prevState.activeInputId}:${prev.stage.id}`;
  if (prevState.cache.get(key) !== nextState.cache.get(key)) return false;

  // Check if parent cache entry changed (affects delta display)
  if (prev.stage.parentId) {
    const parentKey = `${prevState.activeInputId}:${prev.stage.parentId}`;
    if (prevState.cache.get(parentKey) !== nextState.cache.get(parentKey)) return false;
  }

  return true;
});
