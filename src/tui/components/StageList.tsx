import type { PipelineState, PipelineAction } from "../model/types.ts";
import { getActivePath } from "../model/selectors.ts";
import { StageRow } from "./StageRow.tsx";

export interface StageListProps {
  state: PipelineState;
  dispatch: (action: PipelineAction) => void;
}

export function StageList({ state }: StageListProps) {
  const stages = getActivePath(state);
  const isFocused = state.focusedPanel === "pipeline";

  return (
    <box
      width={32}
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? "#FFFFFF" : "#555555"}
    >
      <text fg="#888888">Pipeline</text>
      {stages.length === 0 ? (
        <text fg="#666666">  (empty — press a to add)</text>
      ) : (
        <scrollbox flexDirection="column" flexGrow={1}>
          {stages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              state={state}
              isCursor={stage.id === state.cursorStageId}
            />
          ))}
        </scrollbox>
      )}
    </box>
  );
}
