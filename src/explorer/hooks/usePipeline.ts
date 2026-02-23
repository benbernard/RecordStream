/**
 * usePipeline — React hook wrapping the pipeline reducer.
 *
 * Provides state + dispatch for the pipeline data model.
 * Initializes the state with the given input source if provided.
 */

import { useReducer, useCallback } from "react";
import { nanoid } from "nanoid";
import {
  pipelineReducer,
  createInitialState,
} from "../model/reducer.ts";
import type {
  PipelineState,
  PipelineAction,
  InputSourceType,
} from "../model/types.ts";

export interface UsePipelineOptions {
  /** Initial input source to load */
  initialInput?: {
    source: InputSourceType;
    label: string;
  };
  /** Session ID for persistence */
  sessionId?: string;
}

export interface UsePipelineResult {
  state: PipelineState;
  dispatch: (action: PipelineAction) => void;
}

export function usePipeline(options?: UsePipelineOptions): UsePipelineResult {
  const [state, rawDispatch] = useReducer(
    pipelineReducer,
    options,
    (opts) => {
      const initial = createInitialState({
        sessionId: opts?.sessionId ?? nanoid(),
      });

      // If an initial input is provided, add it to the state
      if (opts?.initialInput) {
        const inputId = initial.activeInputId;
        const inputs = new Map(initial.inputs);
        inputs.set(inputId, {
          id: inputId,
          source: opts.initialInput.source,
          label: opts.initialInput.label,
        });
        return { ...initial, inputs };
      }

      return initial;
    },
  );

  const dispatch = useCallback(
    (action: PipelineAction) => {
      rawDispatch(action);
    },
    [rawDispatch],
  );

  return { state, dispatch };
}
