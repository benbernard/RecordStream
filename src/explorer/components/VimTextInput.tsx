/**
 * VimTextInput — A text input with vim-style editing.
 *
 * Wraps the pure vim-text-engine state machine in a React component
 * that renders inline with chalk.inverse cursor, similar to ink-text-input.
 *
 * Starts in insert mode. Escape toggles to normal mode. Double-escape
 * (Escape in normal mode with no pending operator) propagates to parent
 * via the onEscape callback.
 */

import { useState, useCallback, useEffect } from "react";
import { Text, useInput } from "ink";
import chalk from "chalk";
import {
  processInput,
  initialState,
  type VimState,
  type VimMode,
  type PendingOp,
} from "../utils/vim-text-engine.ts";
import { theme } from "../theme.ts";

export interface VimTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  onEscape?: () => void;
  focus?: boolean;
  placeholder?: string;
}

export function VimTextInput({
  value,
  onChange,
  onSubmit,
  onEscape,
  focus = true,
  placeholder = "",
}: VimTextInputProps) {
  const [vimState, setVimState] = useState<VimState>(() => initialState(value.length));

  // Sync cursor offset if value changes externally
  useEffect(() => {
    setVimState((prev) => {
      if (prev.mode === "insert") {
        if (prev.cursorOffset > value.length) {
          return { ...prev, cursorOffset: value.length };
        }
      } else {
        const maxPos = Math.max(0, value.length - 1);
        if (prev.cursorOffset > maxPos) {
          return { ...prev, cursorOffset: maxPos };
        }
      }
      return prev;
    });
  }, [value]);

  const handleInput = useCallback(
    (input: string, key: import("ink").Key) => {
      const result = processInput(input, key, vimState, value);

      // Update state
      setVimState(result.state);

      // Update value if changed
      if (result.value !== value) {
        onChange(result.value);
      }

      // Handle escaped (double-escape)
      if (result.escaped && onEscape) {
        onEscape();
        return;
      }

      // Handle submitted
      if (result.submitted && onSubmit) {
        onSubmit(result.value);
      }
    },
    [vimState, value, onChange, onSubmit, onEscape],
  );

  useInput(handleInput, { isActive: focus });

  // ── Rendering ──────────────────────────────────────────────

  const { mode, cursorOffset, pending } = vimState;

  // Mode indicator prefix
  const modeIndicator = renderModeIndicator(mode, pending);

  // Render the text with cursor
  let renderedContent: string;

  if (!focus) {
    // Unfocused — just show value or placeholder
    renderedContent = value.length > 0 ? value : (placeholder ? chalk.gray(placeholder) : "");
  } else if (value.length === 0) {
    // Empty value
    if (placeholder) {
      renderedContent = chalk.inverse(placeholder[0] ?? " ") + chalk.gray(placeholder.slice(1));
    } else {
      renderedContent = chalk.inverse(" ");
    }
  } else if (mode === "insert") {
    // Insert mode: bar cursor (can be past last char)
    renderedContent = renderInsertCursor(value, cursorOffset);
  } else {
    // Normal mode: block cursor (on character, 0..len-1)
    const clampedOffset = Math.min(cursorOffset, value.length - 1);
    renderedContent = renderNormalCursor(value, clampedOffset);
  }

  return (
    <Text>
      {modeIndicator} {renderedContent}
    </Text>
  );
}

function renderModeIndicator(mode: VimMode, pending: PendingOp): string {
  if (mode === "insert") {
    return chalk.hex(theme.blue)("[I]");
  }
  if (pending) {
    const opLabel = pending.kind;
    return chalk.hex(theme.peach)(`[N:${opLabel}]`);
  }
  return chalk.hex(theme.peach)("[N]");
}

function renderInsertCursor(value: string, offset: number): string {
  // Insert mode: cursor sits between characters (bar semantic)
  // If cursor is at end, append inverse space
  if (offset >= value.length) {
    return value + chalk.inverse(" ");
  }
  // Cursor on a character — show that char as inverse
  return (
    value.slice(0, offset) +
    chalk.inverse(value[offset]!) +
    value.slice(offset + 1)
  );
}

function renderNormalCursor(value: string, offset: number): string {
  // Normal mode: block cursor on the character
  return (
    value.slice(0, offset) +
    chalk.inverse(value[offset]!) +
    value.slice(offset + 1)
  );
}
