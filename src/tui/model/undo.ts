import type {
  PipelineState,
  PipelineSnapshot,
  PipelineAction,
} from "./types.ts";

export const MAX_UNDO_ENTRIES = 200;

export const UNDOABLE_ACTIONS = new Set<PipelineAction["type"]>([
  "ADD_STAGE",
  "DELETE_STAGE",
  "UPDATE_STAGE_ARGS",
  "TOGGLE_STAGE",
  "INSERT_STAGE_BEFORE",
  "CREATE_FORK",
  "DELETE_FORK",
  "ADD_INPUT",
  "REMOVE_INPUT",
  "REORDER_STAGE",
]);

export function extractSnapshot(state: PipelineState): PipelineSnapshot {
  return {
    stages: new Map(
      Array.from(state.stages.entries()).map(([id, stage]) => [
        id,
        { ...stage, childIds: [...stage.childIds] },
      ]),
    ),
    forks: new Map(
      Array.from(state.forks.entries()).map(([id, fork]) => [
        id,
        { ...fork, stageIds: [...fork.stageIds] },
      ]),
    ),
    inputs: new Map(state.inputs),
    activeInputId: state.activeInputId,
    activeForkId: state.activeForkId,
    cursorStageId: state.cursorStageId,
  };
}

export function describeAction(action: PipelineAction): string {
  switch (action.type) {
    case "ADD_STAGE":
      return `Add ${action.config.operationName} stage`;
    case "DELETE_STAGE":
      return "Delete stage";
    case "UPDATE_STAGE_ARGS":
      return "Update stage arguments";
    case "TOGGLE_STAGE":
      return "Toggle stage enabled";
    case "INSERT_STAGE_BEFORE":
      return `Insert ${action.config.operationName} stage`;
    case "CREATE_FORK":
      return `Create fork "${action.name}"`;
    case "DELETE_FORK":
      return "Delete fork";
    case "ADD_INPUT":
      return `Add input "${action.label}"`;
    case "REMOVE_INPUT":
      return "Remove input";
    case "REORDER_STAGE":
      return `Move stage ${action.direction}`;
    default:
      return action.type;
  }
}
