/**
 * useExecution — Async pipeline execution hook.
 *
 * Watches the cursor stage and triggers execution when needed.
 * On cache hit: no-op (global state already has the result).
 * On cache miss: runs executeToStage and dispatches result to global state.
 *
 * All execution status is managed via dispatch to the global reducer
 * (state.executing, state.lastError, state.cache) rather than local
 * useState, so this hook does NOT cause the host component to re-render
 * on its own — only the dispatched reducer actions trigger re-renders.
 */

import { useEffect, useRef } from "react";
import { executeToStage, getStagePath, SELF_CONTAINED_OPS } from "../executor/executor.ts";
import type {
  PipelineState,
  PipelineAction,
} from "../model/types.ts";

export function useExecution(
  state: PipelineState,
  dispatch: (action: PipelineAction) => void,
): void {
  // Track the latest execution request to ignore stale completions
  const executionIdRef = useRef(0);

  const { cursorStageId, activeInputId, cache } = state;

  // Use a ref to give the effect access to state without re-triggering on every change.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Derive a cache-hit key so the effect only re-fires when the cache
  // entry for the current cursor actually changes (not on every state update).
  const cacheKey = cursorStageId ? `${activeInputId}:${cursorStageId}` : "";
  const hasCacheHit = cacheKey ? cache.has(cacheKey) : false;

  // Fingerprint the cursor stage's config so the effect re-fires when args
  // or enabled state change — even if the cache had no entry (e.g. after an
  // error, where no CACHE_RESULT was dispatched).
  const cursorStage = cursorStageId ? state.stages.get(cursorStageId) : undefined;
  const stageFingerprint = cursorStage
    ? `${cursorStage.config.enabled}:${cursorStage.config.args.join("\0")}`
    : "";

  useEffect(() => {
    if (!cursorStageId) return;

    // Check if the cursor stage exists
    const currentState = stateRef.current;
    const stage = currentState.stages.get(cursorStageId);
    if (!stage) return;

    // Check cache first — result already in global state, nothing to do
    const key = `${activeInputId}:${cursorStageId}`;
    const cached = currentState.cache.get(key);
    if (cached) return;

    // Check if there's an input source available.
    // Self-contained ops (fromps, fromdb, frommongo) don't need one.
    const input = currentState.inputs.get(activeInputId);
    if (!input) {
      const path = getStagePath(currentState, cursorStageId);
      const firstEnabled = path.find((s) => s.config.enabled);
      const needsInput =
        !firstEnabled || !SELF_CONTAINED_OPS.has(firstEnabled.config.operationName);
      if (needsInput) {
        dispatch({
          type: "SET_ERROR",
          stageId: cursorStageId,
          message: "No input source selected",
        });
        return;
      }
    }

    // Cache miss — execute.
    // Use a local working cache so executeToStage doesn't mutate state.cache
    // directly. This is critical for React: direct mutation defeats memo
    // comparators in StageRow that rely on identity checks.
    const workingCache = new Map(currentState.cache);
    const thisExecId = ++executionIdRef.current;

    dispatch({ type: "SET_EXECUTING", executing: true });
    dispatch({ type: "CLEAR_ERROR" });

    executeToStage(currentState, cursorStageId, { workingCache })
      .then((_result) => {
        // Only apply if this is still the latest execution
        if (executionIdRef.current !== thisExecId) return;

        // Dispatch CACHE_RESULT for all newly computed stages (including
        // intermediate results). This ensures both StageRow badges and the
        // InspectorPanel update correctly via React's state flow.
        for (const [key, cachedResult] of workingCache) {
          if (!currentState.cache.has(key)) {
            dispatch({
              type: "CACHE_RESULT",
              inputId: cachedResult.inputId,
              stageId: cachedResult.stageId,
              result: cachedResult,
            });
          }
        }
        dispatch({ type: "SET_EXECUTING", executing: false });
      })
      .catch((err: unknown) => {
        if (executionIdRef.current !== thisExecId) return;

        const message =
          err instanceof Error ? err.message : String(err);
        dispatch({
          type: "SET_ERROR",
          stageId: cursorStageId,
          message,
        });
        dispatch({ type: "SET_EXECUTING", executing: false });
      });
  }, [cursorStageId, activeInputId, hasCacheHit, stageFingerprint, dispatch]);
}
