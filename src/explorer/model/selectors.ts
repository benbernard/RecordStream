import type {
  PipelineState,
  Stage,
  StageId,
  StageKind,
  StageDelta,
  CachedResult,
} from "./types.ts";

/**
 * Get the ordered list of stages in the active fork, walking from root to tip.
 */
export function getActivePath(state: PipelineState): Stage[] {
  const fork = state.forks.get(state.activeForkId);
  if (!fork) return [];

  const stages: Stage[] = [];
  for (const stageId of fork.stageIds) {
    const stage = state.stages.get(stageId);
    if (stage) stages.push(stage);
  }
  return stages;
}

/**
 * Check whether a stage is downstream of the current error stage.
 * A stage is "downstream" if it comes after the error stage in the
 * active fork's stage order.
 */
export function isDownstreamOfError(
  state: PipelineState,
  stageId: StageId,
): boolean {
  if (!state.lastError) return false;

  const fork = state.forks.get(state.activeForkId);
  if (!fork) return false;

  const errorIdx = fork.stageIds.indexOf(state.lastError.stageId);
  const stageIdx = fork.stageIds.indexOf(stageId);

  if (errorIdx === -1 || stageIdx === -1) return false;
  return stageIdx > errorIdx;
}

/**
 * Get cached output for a specific stage + active input combination.
 */
export function getStageOutput(
  state: PipelineState,
  stageId: StageId,
): CachedResult | undefined {
  const key = `${state.activeInputId}:${stageId}`;
  return state.cache.get(key);
}

/**
 * Get the currently-cursored stage, if any.
 */
export function getCursorStage(state: PipelineState): Stage | undefined {
  if (!state.cursorStageId) return undefined;
  return state.stages.get(state.cursorStageId);
}

/**
 * Get the cached output for the currently-cursored stage.
 */
export function getCursorOutput(
  state: PipelineState,
): CachedResult | undefined {
  if (!state.cursorStageId) return undefined;
  return getStageOutput(state, state.cursorStageId);
}

/**
 * Get all stages downstream of a given stage (exclusive) in the active fork.
 */
export function getDownstreamStages(
  state: PipelineState,
  stageId: StageId,
): Stage[] {
  const fork = state.forks.get(state.activeForkId);
  if (!fork) return [];

  const idx = fork.stageIds.indexOf(stageId);
  if (idx === -1) return [];

  return fork.stageIds
    .slice(idx + 1)
    .map((id) => state.stages.get(id))
    .filter((s): s is Stage => s !== undefined);
}

/**
 * Get the total cache size in bytes for the current session.
 */
export function getTotalCacheSize(state: PipelineState): number {
  let total = 0;
  for (const entry of state.cache.values()) {
    total += entry.sizeBytes;
  }
  return total;
}

/**
 * Get enabled stages in the active path (for export).
 */
export function getEnabledStages(state: PipelineState): Stage[] {
  return getActivePath(state).filter((s) => s.config.enabled);
}

/**
 * Classify a stage's operation into a broad kind for delta display.
 */
export function getStageKind(operationName: string): StageKind {
  if (operationName.startsWith("from")) return "input";
  switch (operationName) {
    case "sort":
      return "reorder";
    case "grep":
      return "filter";
    case "collate":
    case "substream":
      return "aggregate";
    default:
      return "transform";
  }
}

/**
 * Compute the delta between a stage and its parent (previous stage output).
 * Returns undefined if the stage has no cached result.
 */
export function getStageDelta(
  state: PipelineState,
  stageId: StageId,
): StageDelta | undefined {
  const cached = getStageOutput(state, stageId);
  if (!cached) return undefined;

  const stage = state.stages.get(stageId);
  if (!stage) return undefined;

  const kind = getStageKind(stage.config.operationName);

  // Get parent cached result (if any)
  let parentCached: CachedResult | undefined;
  if (stage.parentId) {
    parentCached = getStageOutput(state, stage.parentId);
  }

  const parentFields = parentCached ? new Set(parentCached.fieldNames) : new Set<string>();
  const currentFields = new Set(cached.fieldNames);

  let fieldsAdded = 0;
  let fieldsRemoved = 0;
  if (parentCached) {
    for (const f of currentFields) {
      if (!parentFields.has(f)) fieldsAdded++;
    }
    for (const f of parentFields) {
      if (!currentFields.has(f)) fieldsRemoved++;
    }
  }

  // For text-output stages (lines but no records), report line count instead
  const isTextOutput = cached.records.length === 0 && cached.lines.length > 0;
  const outputCount = isTextOutput ? cached.lines.length : cached.recordCount;

  return {
    kind,
    parentCount: parentCached ? parentCached.recordCount : null,
    outputCount,
    fieldsAdded,
    fieldsRemoved,
    isTextOutput,
  };
}
