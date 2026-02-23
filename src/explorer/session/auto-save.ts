/**
 * Debounced auto-save for Explorer session persistence.
 *
 * Saves the pipeline state at a regular interval (30s) and immediately
 * (debounced) on structural changes. Performs a full save on quit.
 * Integrates with UNDOABLE_ACTIONS to detect structural changes.
 */

import type { PipelineState, PipelineAction } from "../model/types.ts";
import { UNDOABLE_ACTIONS } from "../model/undo.ts";
import { SessionManager } from "./session-manager.ts";

const AUTO_SAVE_INTERVAL_MS = 30_000; // 30 seconds
const DEBOUNCE_MS = 2_000; // 2 seconds after structural change

export interface AutoSaveController {
  /** Notify auto-save that an action was dispatched. */
  onAction(action: PipelineAction, state: PipelineState): void;
  /** Perform a full save immediately (call on quit). */
  saveNow(state: PipelineState): Promise<void>;
  /** Stop the auto-save timers and clean up. */
  dispose(): void;
}

/**
 * Create an auto-save controller that manages debounced and interval saves.
 */
export function createAutoSave(
  sessionManager: SessionManager,
  options?: {
    intervalMs?: number;
    debounceMs?: number;
  },
): AutoSaveController {
  const intervalMs = options?.intervalMs ?? AUTO_SAVE_INTERVAL_MS;
  const debounceMs = options?.debounceMs ?? DEBOUNCE_MS;

  let intervalTimer: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let latestState: PipelineState | null = null;
  let saving = false;
  let dirty = false;

  async function doSave(state: PipelineState): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      await sessionManager.save(state);
      dirty = false;
    } catch {
      // Save failed — will retry on next trigger
    } finally {
      saving = false;
    }
  }

  function startInterval(): void {
    if (intervalTimer !== null) return;
    intervalTimer = setInterval(() => {
      if (latestState && dirty) {
        void doSave(latestState);
      }
    }, intervalMs);
  }

  function scheduleDebouncedSave(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (latestState && dirty) {
        void doSave(latestState);
      }
    }, debounceMs);
  }

  // Start the interval timer
  startInterval();

  return {
    onAction(action: PipelineAction, state: PipelineState): void {
      latestState = state;

      if (UNDOABLE_ACTIONS.has(action.type)) {
        dirty = true;
        scheduleDebouncedSave();
      }
    },

    async saveNow(state: PipelineState): Promise<void> {
      latestState = state;
      // Cancel any pending debounce
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      await doSave(state);
    },

    dispose(): void {
      if (intervalTimer !== null) {
        clearInterval(intervalTimer);
        intervalTimer = null;
      }
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    },
  };
}
