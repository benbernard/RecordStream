import { nanoid } from "nanoid";
import type {
  PipelineState,
  PipelineAction,
  Stage,
  StageId,
  Fork,
  CachedResult,
  CacheConfig,
  InspectorState,
} from "./types.ts";
import {
  UNDOABLE_ACTIONS,
  MAX_UNDO_ENTRIES,
  extractSnapshot,
  describeAction,
} from "./undo.ts";

// ── Initial state factory ─────────────────────────────────────────

export function createInitialState(
  overrides?: Partial<PipelineState>,
): PipelineState {
  const mainForkId = nanoid();
  const mainInputId = nanoid();

  const defaultCacheConfig: CacheConfig = {
    maxMemoryBytes: 512 * 1024 * 1024, // 512 MB
    cachePolicy: "all",
    pinnedStageIds: new Set(),
  };

  const defaultInspector: InspectorState = {
    viewMode: "table",
    scrollOffset: 0,
    searchQuery: null,
  };

  const mainFork: Fork = {
    id: mainForkId,
    name: "main",
    forkPointStageId: null,
    parentForkId: null,
    stageIds: [],
    createdAt: Date.now(),
  };

  return {
    stages: new Map(),
    forks: new Map([[mainForkId, mainFork]]),
    inputs: new Map(),
    activeInputId: mainInputId,
    activeForkId: mainForkId,
    cursorStageId: null,
    focusedPanel: "pipeline",
    cache: new Map(),
    cacheConfig: defaultCacheConfig,
    inspector: defaultInspector,
    executing: false,
    lastError: null,
    undoStack: [],
    redoStack: [],
    sessionId: nanoid(),
    sessionDir: "",
    ...overrides,
  };
}

// ── Reducer ───────────────────────────────────────────────────────

export function pipelineReducer(
  state: PipelineState,
  action: PipelineAction,
): PipelineState {
  // Early-return guard: skip undo checkpoint for actions targeting nonexistent entities
  if (wouldBeNoop(state, action)) return state;

  // Undo checkpoint: push snapshot before structural actions
  if (UNDOABLE_ACTIONS.has(action.type)) {
    const snapshot = extractSnapshot(state);
    const label = describeAction(action);
    let undoStack = [...state.undoStack, { label, snapshot, timestamp: Date.now() }];
    if (undoStack.length > MAX_UNDO_ENTRIES) {
      undoStack = undoStack.slice(undoStack.length - MAX_UNDO_ENTRIES);
    }
    state = {
      ...state,
      undoStack,
      redoStack: [],
    };
  }

  switch (action.type) {
    // ── Undo / Redo ─────────────────────────────────────────────
    case "UNDO": {
      if (state.undoStack.length === 0) return state;
      const entry = state.undoStack[state.undoStack.length - 1]!;
      const currentSnapshot = extractSnapshot(state);
      return {
        ...state,
        ...entry.snapshot,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [
          ...state.redoStack,
          { label: entry.label, snapshot: currentSnapshot, timestamp: Date.now() },
        ],
      };
    }
    case "REDO": {
      if (state.redoStack.length === 0) return state;
      const entry = state.redoStack[state.redoStack.length - 1]!;
      const currentSnapshot = extractSnapshot(state);
      return {
        ...state,
        ...entry.snapshot,
        undoStack: [
          ...state.undoStack,
          { label: entry.label, snapshot: currentSnapshot, timestamp: Date.now() },
        ],
        redoStack: state.redoStack.slice(0, -1),
      };
    }

    // ── Add stage after cursor or at end ────────────────────────
    case "ADD_STAGE": {
      const fork = state.forks.get(state.activeForkId);
      if (!fork) return state;

      const stageId = nanoid();
      const stageIds = [...fork.stageIds];
      let insertIndex: number;

      if (action.afterStageId === null) {
        // Append to end of fork
        insertIndex = stageIds.length;
      } else {
        const idx = stageIds.indexOf(action.afterStageId);
        insertIndex = idx === -1 ? stageIds.length : idx + 1;
      }

      stageIds.splice(insertIndex, 0, stageId);

      // Determine parentId / childIds by position in fork
      const parentId = insertIndex > 0 ? (stageIds[insertIndex - 1] ?? null) : null;
      const childId =
        insertIndex < stageIds.length - 1
          ? (stageIds[insertIndex + 1] ?? null)
          : null;

      const newStage: Stage = {
        id: stageId,
        config: { ...action.config },
        parentId,
        childIds: childId ? [childId] : [],
        forkId: state.activeForkId,
        position: insertIndex,
      };

      const stages = new Map(state.stages);
      stages.set(stageId, newStage);

      // Update parent's childIds to point to new stage
      if (parentId) {
        const parent = stages.get(parentId);
        if (parent) {
          const newChildIds = parent.childIds.map((cid) =>
            cid === childId ? stageId : cid,
          );
          if (!newChildIds.includes(stageId)) {
            newChildIds.push(stageId);
          }
          stages.set(parentId, { ...parent, childIds: newChildIds });
        }
      }

      // Update child's parentId to point to new stage
      if (childId) {
        const child = stages.get(childId);
        if (child) {
          stages.set(childId, { ...child, parentId: stageId });
        }
      }

      // Recompute positions
      recomputePositions(stages, stageIds);

      const forks = new Map(state.forks);
      forks.set(state.activeForkId, { ...fork, stageIds });

      return {
        ...state,
        stages,
        forks,
        cursorStageId: stageId,
      };
    }

    // ── Insert stage before a specific stage ────────────────────
    case "INSERT_STAGE_BEFORE": {
      const fork = state.forks.get(state.activeForkId);
      if (!fork) return state;

      const stageIds = [...fork.stageIds];
      const idx = stageIds.indexOf(action.beforeStageId);
      if (idx === -1) return state;

      const stageId = nanoid();
      stageIds.splice(idx, 0, stageId);

      const parentId = idx > 0 ? (stageIds[idx - 1] ?? null) : null;
      const childId = action.beforeStageId;

      const newStage: Stage = {
        id: stageId,
        config: { ...action.config },
        parentId,
        childIds: [childId],
        forkId: state.activeForkId,
        position: idx,
      };

      const stages = new Map(state.stages);
      stages.set(stageId, newStage);

      // Update child's parentId
      const child = stages.get(childId);
      if (child) {
        stages.set(childId, { ...child, parentId: stageId });
      }

      // Update parent's childIds
      if (parentId) {
        const parent = stages.get(parentId);
        if (parent) {
          stages.set(parentId, {
            ...parent,
            childIds: parent.childIds.map((cid) =>
              cid === childId ? stageId : cid,
            ),
          });
        }
      }

      recomputePositions(stages, stageIds);

      const forks = new Map(state.forks);
      forks.set(state.activeForkId, { ...fork, stageIds });

      return {
        ...state,
        stages,
        forks,
        cursorStageId: stageId,
      };
    }

    // ── Delete stage ────────────────────────────────────────────
    case "DELETE_STAGE": {
      const stage = state.stages.get(action.stageId);
      if (!stage) return state;

      const fork = state.forks.get(stage.forkId);
      if (!fork) return state;

      const stageIds = fork.stageIds.filter((id) => id !== action.stageId);
      const stages = new Map(state.stages);

      // Re-link parent ↔ child around the deleted stage
      if (stage.parentId) {
        const parent = stages.get(stage.parentId);
        if (parent) {
          const newChildIds = parent.childIds
            .filter((cid) => cid !== action.stageId)
            .concat(stage.childIds);
          stages.set(stage.parentId, { ...parent, childIds: newChildIds });
        }
      }
      for (const childId of stage.childIds) {
        const child = stages.get(childId);
        if (child) {
          stages.set(childId, { ...child, parentId: stage.parentId });
        }
      }

      stages.delete(action.stageId);
      recomputePositions(stages, stageIds);

      const forks = new Map(state.forks);
      forks.set(stage.forkId, { ...fork, stageIds });

      // Move cursor to neighbor
      let cursorStageId: StageId | null = null;
      if (stageIds.length > 0) {
        const oldIdx = fork.stageIds.indexOf(action.stageId);
        const newIdx = Math.min(oldIdx, stageIds.length - 1);
        cursorStageId = stageIds[newIdx] ?? null;
      }

      return {
        ...state,
        stages,
        forks,
        cursorStageId,
        lastError:
          state.lastError?.stageId === action.stageId ? null : state.lastError,
      };
    }

    // ── Update stage args ───────────────────────────────────────
    case "UPDATE_STAGE_ARGS": {
      const stage = state.stages.get(action.stageId);
      if (!stage) return state;

      const stages = new Map(state.stages);
      stages.set(action.stageId, {
        ...stage,
        config: { ...stage.config, args: [...action.args] },
      });

      const cache = invalidateStageAndDownstream(state.cache, state.forks, stage);

      return { ...state, stages, cache };
    }

    // ── Toggle stage enabled ────────────────────────────────────
    case "TOGGLE_STAGE": {
      const stage = state.stages.get(action.stageId);
      if (!stage) return state;

      const stages = new Map(state.stages);
      stages.set(action.stageId, {
        ...stage,
        config: { ...stage.config, enabled: !stage.config.enabled },
      });

      const cache = invalidateStageAndDownstream(state.cache, state.forks, stage);

      return { ...state, stages, cache };
    }

    // ── Reorder stage ───────────────────────────────────────────
    case "REORDER_STAGE": {
      const stage = state.stages.get(action.stageId);
      if (!stage) return state;

      const fork = state.forks.get(stage.forkId);
      if (!fork) return state;

      const stageIds = [...fork.stageIds];
      const idx = stageIds.indexOf(action.stageId);
      if (idx === -1) return state;

      const newIdx =
        action.direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= stageIds.length) return state;

      // Swap positions
      [stageIds[idx], stageIds[newIdx]] = [stageIds[newIdx]!, stageIds[idx]!];

      const stages = new Map(state.stages);

      // Rebuild parent/child links for the swapped stages
      rebuildLinksForFork(stages, stageIds);
      recomputePositions(stages, stageIds);

      const forks = new Map(state.forks);
      forks.set(stage.forkId, { ...fork, stageIds });

      return { ...state, stages, forks };
    }

    // ── Create fork ─────────────────────────────────────────────
    case "CREATE_FORK": {
      const parentFork = state.forks.get(state.activeForkId);
      if (!parentFork) return state;

      const forkId = nanoid();
      const newFork: Fork = {
        id: forkId,
        name: action.name,
        forkPointStageId: action.atStageId,
        parentForkId: state.activeForkId,
        stageIds: [],
        createdAt: Date.now(),
      };

      const forks = new Map(state.forks);
      forks.set(forkId, newFork);

      return {
        ...state,
        forks,
        activeForkId: forkId,
      };
    }

    // ── Delete fork ─────────────────────────────────────────────
    case "DELETE_FORK": {
      const fork = state.forks.get(action.forkId);
      if (!fork || fork.parentForkId === null) return state; // can't delete main fork

      const forks = new Map(state.forks);
      forks.delete(action.forkId);

      // Remove all stages belonging to this fork
      const stages = new Map(state.stages);
      for (const stageId of fork.stageIds) {
        stages.delete(stageId);
      }

      const activeForkId = fork.parentForkId;

      return {
        ...state,
        stages,
        forks,
        activeForkId,
        cursorStageId: null,
      };
    }

    // ── Add input ───────────────────────────────────────────────
    case "ADD_INPUT": {
      const inputId = nanoid();
      const inputs = new Map(state.inputs);
      inputs.set(inputId, {
        id: inputId,
        source: action.source,
        label: action.label,
      });

      return { ...state, inputs, activeInputId: inputId };
    }

    // ── Remove input ────────────────────────────────────────────
    case "REMOVE_INPUT": {
      if (state.inputs.size <= 1) return state; // keep at least one

      const inputs = new Map(state.inputs);
      inputs.delete(action.inputId);

      const activeInputId =
        state.activeInputId === action.inputId
          ? inputs.keys().next().value!
          : state.activeInputId;

      return { ...state, inputs, activeInputId };
    }

    // ── Cursor movement ─────────────────────────────────────────
    case "MOVE_CURSOR": {
      const fork = state.forks.get(state.activeForkId);
      if (!fork || fork.stageIds.length === 0) return state;

      const currentIdx = state.cursorStageId
        ? fork.stageIds.indexOf(state.cursorStageId)
        : -1;

      let newIdx: number;
      if (action.direction === "up") {
        newIdx = currentIdx <= 0 ? 0 : currentIdx - 1;
      } else {
        newIdx =
          currentIdx >= fork.stageIds.length - 1
            ? fork.stageIds.length - 1
            : currentIdx + 1;
      }

      return {
        ...state,
        cursorStageId: fork.stageIds[newIdx] ?? null,
      };
    }

    case "SET_CURSOR":
      return { ...state, cursorStageId: action.stageId };

    // ── Switch input / fork ─────────────────────────────────────
    case "SWITCH_INPUT":
      return { ...state, activeInputId: action.inputId };

    case "SWITCH_FORK":
      return { ...state, activeForkId: action.forkId, cursorStageId: null };

    // ── Cache ───────────────────────────────────────────────────
    case "CACHE_RESULT": {
      const cache = new Map(state.cache);
      cache.set(`${action.inputId}:${action.stageId}`, action.result);
      return { ...state, cache };
    }

    case "INVALIDATE_STAGE": {
      const cache = new Map(state.cache);
      // Remove all cache entries for this stageId (any input)
      for (const [key] of cache) {
        if (key.endsWith(`:${action.stageId}`)) {
          cache.delete(key);
        }
      }
      return { ...state, cache };
    }

    case "PIN_STAGE": {
      const pinnedStageIds = new Set(state.cacheConfig.pinnedStageIds);
      if (pinnedStageIds.has(action.stageId)) {
        pinnedStageIds.delete(action.stageId);
      } else {
        pinnedStageIds.add(action.stageId);
      }
      return {
        ...state,
        cacheConfig: { ...state.cacheConfig, pinnedStageIds },
      };
    }

    case "SET_CACHE_POLICY":
      return {
        ...state,
        cacheConfig: { ...state.cacheConfig, cachePolicy: action.policy },
      };

    // ── Error state ─────────────────────────────────────────────
    case "SET_ERROR":
      return {
        ...state,
        lastError: { stageId: action.stageId, message: action.message },
      };

    case "CLEAR_ERROR":
      return { ...state, lastError: null };

    // ── Execution state ─────────────────────────────────────────
    case "SET_EXECUTING":
      return { ...state, executing: action.executing };

    // ── Focus toggle ────────────────────────────────────────────
    case "TOGGLE_FOCUS":
      return {
        ...state,
        focusedPanel:
          state.focusedPanel === "pipeline" ? "inspector" : "pipeline",
      };

    // ── Inspector view mode ─────────────────────────────────────
    case "SET_VIEW_MODE":
      return {
        ...state,
        inspector: { ...state.inspector, viewMode: action.viewMode },
      };

    default:
      return state;
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function recomputePositions(
  stages: Map<StageId, Stage>,
  stageIds: StageId[],
): void {
  for (let i = 0; i < stageIds.length; i++) {
    const id = stageIds[i]!;
    const stage = stages.get(id);
    if (stage && stage.position !== i) {
      stages.set(id, { ...stage, position: i });
    }
  }
}

function rebuildLinksForFork(
  stages: Map<StageId, Stage>,
  stageIds: StageId[],
): void {
  for (let i = 0; i < stageIds.length; i++) {
    const id = stageIds[i]!;
    const stage = stages.get(id);
    if (!stage) continue;

    const parentId = i > 0 ? (stageIds[i - 1] ?? null) : null;
    const childId =
      i < stageIds.length - 1 ? (stageIds[i + 1] ?? null) : null;

    stages.set(id, {
      ...stage,
      parentId,
      childIds: childId ? [childId] : [],
    });
  }
}

/**
 * Remove cache entries for a stage and all downstream stages in the same fork.
 * Called when a stage's config changes (args update, toggle enabled) to ensure
 * the inspector doesn't show stale cached results.
 */
function invalidateStageAndDownstream(
  cache: Map<string, CachedResult>,
  forks: Map<string, Fork>,
  stage: Stage,
): Map<string, CachedResult> {
  const fork = forks.get(stage.forkId);
  if (!fork) return cache;

  const idx = fork.stageIds.indexOf(stage.id);
  if (idx === -1) return cache;

  // This stage + all stages after it in the fork
  const toInvalidate = new Set(fork.stageIds.slice(idx));

  const newCache = new Map(cache);
  for (const [key] of newCache) {
    for (const sid of toInvalidate) {
      if (key.endsWith(`:${sid}`)) {
        newCache.delete(key);
        break;
      }
    }
  }
  return newCache;
}

/**
 * Pre-check whether an action would be a no-op so we can skip the undo checkpoint.
 * Returns true if the action should be short-circuited (return state unchanged).
 */
function wouldBeNoop(state: PipelineState, action: PipelineAction): boolean {
  switch (action.type) {
    case "DELETE_STAGE":
    case "UPDATE_STAGE_ARGS":
    case "TOGGLE_STAGE":
      return !state.stages.has(action.stageId);
    case "INSERT_STAGE_BEFORE":
      return !state.stages.has(action.beforeStageId);
    case "REORDER_STAGE": {
      const stage = state.stages.get(action.stageId);
      if (!stage) return true;
      const fork = state.forks.get(stage.forkId);
      if (!fork) return true;
      const idx = fork.stageIds.indexOf(action.stageId);
      const newIdx = action.direction === "up" ? idx - 1 : idx + 1;
      return newIdx < 0 || newIdx >= fork.stageIds.length;
    }
    case "DELETE_FORK": {
      const fork = state.forks.get(action.forkId);
      return !fork || fork.parentForkId === null;
    }
    case "REMOVE_INPUT":
      return state.inputs.size <= 1 || !state.inputs.has(action.inputId);
    default:
      return false;
  }
}
