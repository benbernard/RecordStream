import type { PipelineState } from "../model/types.ts";
import { getCursorStage, getCursorOutput } from "../model/selectors.ts";

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

export function InspectorHeader({ state }: InspectorHeaderProps) {
  const stage = getCursorStage(state);
  const output = getCursorOutput(state);

  if (!stage) {
    return (
      <box height={1}>
        <text fg="#888888">Inspector: (select a stage)</text>
      </box>
    );
  }

  if (state.executing) {
    return (
      <box height={1}>
        <text fg="#FFCC00">Inspector: {stage.config.operationName} (computing...)</text>
      </box>
    );
  }

  if (state.lastError?.stageId === stage.id) {
    return (
      <box height={1}>
        <text fg="#FF4444">Inspector: {stage.config.operationName} — ERROR</text>
      </box>
    );
  }

  const countStr = output ? `${output.recordCount} records` : "not cached";
  const cacheAge = output ? `, cached ${formatCacheAge(output.computedAt)}` : "";

  return (
    <box height={1}>
      <text>
        Inspector: {stage.config.operationName} ({countStr}{cacheAge})
      </text>
    </box>
  );
}
