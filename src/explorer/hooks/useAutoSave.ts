/**
 * useAutoSave — React hook for debounced session persistence.
 *
 * Wraps createAutoSave to manage lifecycle within a React component tree.
 * Sets up auto-save on mount, cleans up on unmount, and performs a full
 * save on quit (via returned saveNow function).
 */

import { useRef, useEffect, useCallback } from "react";
import type { PipelineState, PipelineAction } from "../model/types.ts";
import {
  createAutoSave,
  type AutoSaveController,
} from "../session/auto-save.ts";
import { SessionManager } from "../session/session-manager.ts";

interface UseAutoSaveResult {
  /** Notify auto-save that an action was dispatched. */
  onAction: (action: PipelineAction, state: PipelineState) => void;
  /** Perform a full save immediately (call on quit). */
  saveNow: (state: PipelineState) => Promise<void>;
}

export function useAutoSave(_state: PipelineState): UseAutoSaveResult {
  const controllerRef = useRef<AutoSaveController | null>(null);

  useEffect(() => {
    const manager = new SessionManager();
    const controller = createAutoSave(manager);
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const onAction = useCallback(
    (action: PipelineAction, actionState: PipelineState) => {
      controllerRef.current?.onAction(action, actionState);
    },
    [],
  );

  const saveNow = useCallback(async (saveState: PipelineState) => {
    await controllerRef.current?.saveNow(saveState);
  }, []);

  return { onAction, saveNow };
}
