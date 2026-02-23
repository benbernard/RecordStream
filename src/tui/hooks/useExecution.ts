/**
 * useExecution — Async pipeline execution hook.
 *
 * Watches the cursor stage and triggers execution when needed.
 * On cache hit: returns cached result immediately.
 * On cache miss: runs executeToStage and updates state with result.
 *
 * Returns execution status, the current result, and any error.
 */

import { useState, useEffect, useRef } from "react";
import { executeToStage } from "../executor/executor.ts";
import type {
  PipelineState,
  PipelineAction,
  CachedResult,
} from "../model/types.ts";

export interface UseExecutionResult {
  /** Whether the executor is currently running */
  isExecuting: boolean;
  /** The result for the current cursor stage (if available) */
  currentResult: CachedResult | null;
  /** Error message if execution failed */
  error: string | null;
}

export function useExecution(
  state: PipelineState,
  dispatch: (action: PipelineAction) => void,
): UseExecutionResult {
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentResult, setCurrentResult] = useState<CachedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the latest execution request to ignore stale completions
  const executionIdRef = useRef(0);

  const { cursorStageId, activeInputId, cache, stages } = state;

  useEffect(() => {
    if (!cursorStageId) {
      setCurrentResult(null);
      setError(null);
      return;
    }

    // Check if the cursor stage exists
    const stage = stages.get(cursorStageId);
    if (!stage) {
      setCurrentResult(null);
      setError(null);
      return;
    }

    // Check cache first
    const cacheKey = `${activeInputId}:${cursorStageId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      setCurrentResult(cached);
      setError(null);
      setIsExecuting(false);
      return;
    }

    // Check if there's an input source available
    const input = state.inputs.get(activeInputId);
    if (!input) {
      setError("No input source selected");
      setCurrentResult(null);
      return;
    }

    // Cache miss — execute
    const thisExecId = ++executionIdRef.current;
    setIsExecuting(true);
    setError(null);

    dispatch({ type: "SET_EXECUTING", executing: true });
    dispatch({ type: "CLEAR_ERROR" });

    executeToStage(state, cursorStageId)
      .then((result) => {
        // Only apply if this is still the latest execution
        if (executionIdRef.current !== thisExecId) return;

        setCurrentResult(result);
        setIsExecuting(false);

        dispatch({
          type: "CACHE_RESULT",
          inputId: activeInputId,
          stageId: cursorStageId,
          result,
        });
        dispatch({ type: "SET_EXECUTING", executing: false });
      })
      .catch((err: unknown) => {
        if (executionIdRef.current !== thisExecId) return;

        const message =
          err instanceof Error ? err.message : String(err);
        setError(message);
        setIsExecuting(false);
        setCurrentResult(null);

        dispatch({
          type: "SET_ERROR",
          stageId: cursorStageId,
          message,
        });
        dispatch({ type: "SET_EXECUTING", executing: false });
      });
  }, [cursorStageId, activeInputId, cache, stages, state, dispatch]);

  return { isExecuting, currentResult, error };
}
