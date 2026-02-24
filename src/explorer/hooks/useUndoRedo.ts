/**
 * useUndoRedo — Exposes undo/redo availability and labels from pipeline state.
 *
 * Provides derived state for the StatusBar and other components to display
 * undo/redo information (counts, availability, last action label).
 *
 * Note: The actual keyboard bindings (u for undo, Ctrl+R for redo) are
 * handled in App.tsx's global useKeyboard handler, not in this hook.
 */

import { useMemo } from "react";
import type { PipelineState } from "../model/types.ts";

export interface UseUndoRedoResult {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of entries on the undo stack */
  undoCount: number;
  /** Number of entries on the redo stack */
  redoCount: number;
  /** Label of the next undo action (e.g., "Add grep stage") */
  nextUndoLabel: string | null;
  /** Label of the next redo action */
  nextRedoLabel: string | null;
}

export function useUndoRedo(state: PipelineState): UseUndoRedoResult {
  return useMemo(() => {
    const undoCount = state.undoStack.length;
    const redoCount = state.redoStack.length;

    const nextUndoLabel =
      undoCount > 0
        ? (state.undoStack[undoCount - 1]?.label ?? null)
        : null;

    const nextRedoLabel =
      redoCount > 0
        ? (state.redoStack[redoCount - 1]?.label ?? null)
        : null;

    return {
      canUndo: undoCount > 0,
      canRedo: redoCount > 0,
      undoCount,
      redoCount,
      nextUndoLabel,
      nextRedoLabel,
    };
  }, [state.undoStack, state.redoStack]);
}
