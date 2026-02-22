/**
 * useAutoSave — Stub for Phase 3 session persistence.
 *
 * In Phase 3, this will debounce auto-saves to ~/.config/recs-tui/sessions/
 * on structural changes and at regular intervals. For now, it's a no-op
 * so components can import it without errors.
 */

import type { PipelineState } from "../model/types.ts";

export function useAutoSave(_state: PipelineState): void {
  // Phase 3: Implement debounced session persistence
  // - Save every 30s and on structural change
  // - Write session.json + cache JSONL files
  // - Handle session directory creation
}
