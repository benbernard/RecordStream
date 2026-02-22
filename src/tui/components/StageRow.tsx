import type { Stage, PipelineState, StageId } from "../model/types.ts";
import { isDownstreamOfError, getStageOutput } from "../model/selectors.ts";

export interface StageRowProps {
  stage: Stage;
  state: PipelineState;
  isCursor: boolean;
}

function getCacheIndicator(
  state: PipelineState,
  stageId: StageId,
): string {
  if (state.lastError?.stageId === stageId) return "\u2717"; // ✗
  if (state.executing && state.cursorStageId === stageId) return "\u27F3"; // ⟳
  const cached = getStageOutput(state, stageId);
  if (cached) return "\u2713"; // ✓
  return "\u26A1"; // ⚡
}

function getRecordCount(
  state: PipelineState,
  stageId: StageId,
): string {
  const cached = getStageOutput(state, stageId);
  if (cached) return String(cached.recordCount);
  return "----";
}

export function StageRow({ stage, state, isCursor }: StageRowProps) {
  const isError = state.lastError?.stageId === stage.id;
  const isDisabled = !stage.config.enabled;
  const isDownstream = isDownstreamOfError(state, stage.id);

  const cacheIcon = getCacheIndicator(state, stage.id);
  const count = getRecordCount(state, stage.id);
  const cursor = isCursor ? ">" : " ";

  const argsStr = stage.config.args.join(" ");
  const truncatedArgs = argsStr.length > 20 ? argsStr.slice(0, 17) + "..." : argsStr;

  // Determine fg color
  let fg: string | undefined;
  if (isError) {
    fg = "#FF4444";
  } else if (isDisabled || isDownstream) {
    fg = "#666666";
  } else if (isCursor) {
    fg = "#FFFFFF";
  }

  const bg = isCursor ? "#333333" : undefined;
  const posStr = String(stage.position + 1).padStart(3);
  const disabledMarker = isDisabled ? " [off]" : "";

  return (
    <box flexDirection="column" width="100%" backgroundColor={bg}>
      <text fg={fg} bg={bg}>
        {cursor} {posStr} {stage.config.operationName}  {cacheIcon}  {count}{disabledMarker}
      </text>
      {truncatedArgs ? (
        <text fg={isDisabled || isDownstream ? "#555555" : "#AAAAAA"} bg={bg}>
          {"     "}{truncatedArgs}
        </text>
      ) : null}
    </box>
  );
}
