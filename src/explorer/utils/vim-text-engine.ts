/**
 * vim-text-engine — Pure state machine for vim-style text editing.
 *
 * Zero React dependencies. Receives an ink Key + input string,
 * current state, and value; returns the next state + value.
 */

import type { Key } from "ink";

// ── Types ──────────────────────────────────────────────────────

export type VimMode = "insert" | "normal";

export type PendingOp =
  | null
  | { kind: "d" }
  | { kind: "c" }
  | { kind: "r" }
  | { kind: "g" }
  | { kind: "f" }
  | { kind: "t" }
  | { kind: "F" }
  | { kind: "T" }
  | { kind: "df" }
  | { kind: "dt" }
  | { kind: "cf" }
  | { kind: "ct" }
  | { kind: "dF" }
  | { kind: "dT" }
  | { kind: "cF" }
  | { kind: "cT" };

export interface LastFind {
  dir: "forward" | "backward";
  inclusive: boolean;
  char: string;
}

export interface VimState {
  mode: VimMode;
  cursorOffset: number;
  pending: PendingOp;
  lastFind?: LastFind | null;
  lastInsertOffset?: number;
}

export interface VimResult {
  state: VimState;
  value: string;
  escaped: boolean;
  submitted: boolean;
  passThrough: boolean;
}

// ── Word boundary helpers (exported for testing) ───────────────

export function charClass(ch: string): "word" | "punct" | "space" {
  if (/\s/.test(ch)) return "space";
  if (/\w/.test(ch)) return "word";
  return "punct";
}

/** Find the start of the next vim word (w motion). Returns unclamped position. */
export function findNextWordStart(text: string, pos: number): number {
  if (pos >= text.length) return text.length;
  const startClass = charClass(text[pos]!);
  let i = pos;
  // Skip current class
  while (i < text.length && charClass(text[i]!) === startClass) i++;
  // Skip whitespace
  while (i < text.length && charClass(text[i]!) === "space") i++;
  return i;
}

/** Find the start of the previous vim word (b motion). */
export function findPrevWordStart(text: string, pos: number): number {
  if (pos <= 0) return 0;
  let i = pos - 1;
  // Skip whitespace
  while (i > 0 && charClass(text[i]!) === "space") i--;
  if (i <= 0) return 0;
  const targetClass = charClass(text[i]!);
  // Move back through same class
  while (i > 0 && charClass(text[i - 1]!) === targetClass) i--;
  return i;
}

/** Find the start of the next WORD (W motion, whitespace-delimited). Returns unclamped. */
export function findNextWORDStart(text: string, pos: number): number {
  if (pos >= text.length) return text.length;
  let i = pos;
  // Skip non-space
  while (i < text.length && charClass(text[i]!) !== "space") i++;
  // Skip space
  while (i < text.length && charClass(text[i]!) === "space") i++;
  return i;
}

/** Find the start of the previous WORD (B motion, whitespace-delimited). */
export function findPrevWORDStart(text: string, pos: number): number {
  if (pos <= 0) return 0;
  let i = pos - 1;
  // Skip whitespace
  while (i > 0 && charClass(text[i]!) === "space") i--;
  if (i <= 0) return 0;
  // Move back through non-space
  while (i > 0 && charClass(text[i - 1]!) !== "space") i--;
  return i;
}

/** Find the next occurrence of `char` forward from pos (exclusive). Returns -1 if not found. */
export function findCharForward(text: string, pos: number, char: string): number {
  const idx = text.indexOf(char, pos + 1);
  return idx;
}

/** Find the next occurrence of `char` backward from pos (exclusive). Returns -1 if not found. */
export function findCharBackward(text: string, pos: number, char: string): number {
  for (let i = pos - 1; i >= 0; i--) {
    if (text[i] === char) return i;
  }
  return -1;
}

/** Find the end of the current/next word (e motion). Returns position of last char. */
export function findWordEnd(text: string, pos: number): number {
  if (pos >= text.length - 1) return Math.max(0, text.length - 1);
  let i = pos + 1;
  // Skip whitespace
  while (i < text.length && charClass(text[i]!) === "space") i++;
  if (i >= text.length) return text.length - 1;
  const cls = charClass(text[i]!);
  // Advance through same class
  while (i + 1 < text.length && charClass(text[i + 1]!) === cls) i++;
  return i;
}

/** Find the end of the previous word (ge motion). Returns position. */
export function findPrevWordEnd(text: string, pos: number): number {
  if (pos <= 0) return 0;
  let i = pos - 1;
  // Skip whitespace
  while (i > 0 && charClass(text[i]!) === "space") i--;
  if (i === 0 && charClass(text[i]!) === "space") return 0;
  // If no whitespace was crossed and we started in a non-space, skip through current word
  if (i === pos - 1 && pos < text.length && charClass(text[pos]!) !== "space") {
    const cls = charClass(text[i]!);
    while (i > 0 && charClass(text[i - 1]!) === cls) i--;
    if (i <= 0) return 0;
    i--;
    while (i > 0 && charClass(text[i]!) === "space") i--;
    if (charClass(text[i]!) === "space") return 0;
  }
  return i;
}

// ── Clamp helper ───────────────────────────────────────────────

function clampNormal(offset: number, len: number): number {
  if (len === 0) return 0;
  return Math.max(0, Math.min(offset, len - 1));
}

function clampInsert(offset: number, len: number): number {
  return Math.max(0, Math.min(offset, len));
}

// ── Default state ──────────────────────────────────────────────

export function initialState(valueLength: number): VimState {
  return { mode: "insert", cursorOffset: valueLength, pending: null };
}

// ── Top-level dispatch ─────────────────────────────────────────

export function processInput(
  input: string,
  key: Key,
  state: VimState,
  value: string,
): VimResult {
  if (state.mode === "insert") {
    return processInsert(input, key, state, value);
  }
  return processNormal(input, key, state, value);
}

// ── Insert mode ────────────────────────────────────────────────

function processInsert(
  input: string,
  key: Key,
  state: VimState,
  value: string,
): VimResult {
  const result = (): VimResult => ({
    state,
    value,
    escaped: false,
    submitted: false,
    passThrough: false,
  });

  // Pass-through keys: Tab, Up/Down arrows, Ctrl+C
  if (key.tab || key.upArrow || key.downArrow || (key.ctrl && input === "c")) {
    return { ...result(), passThrough: true };
  }

  // Escape → normal mode (store lastInsertOffset for gi)
  if (key.escape) {
    const newOffset = clampNormal(state.cursorOffset - 1, value.length);
    return {
      ...result(),
      state: {
        mode: "normal",
        cursorOffset: newOffset,
        pending: null,
        lastFind: state.lastFind,
        lastInsertOffset: state.cursorOffset,
      },
    };
  }

  // Enter → submit
  if (key.return) {
    return { ...result(), submitted: true };
  }

  // Ctrl+U → clear entire line
  if (key.ctrl && input === "u") {
    return {
      ...result(),
      state: { ...state, cursorOffset: 0 },
      value: "",
    };
  }

  // Ctrl+K → clear from cursor to end
  if (key.ctrl && input === "k") {
    return {
      ...result(),
      value: value.slice(0, state.cursorOffset),
    };
  }

  // Ctrl+W → delete backward word
  if (key.ctrl && input === "w") {
    const wordStart = findPrevWordStart(value, state.cursorOffset);
    const newValue = value.slice(0, wordStart) + value.slice(state.cursorOffset);
    return {
      ...result(),
      state: { ...state, cursorOffset: wordStart },
      value: newValue,
    };
  }

  // Ctrl+A → move to line start
  if (key.ctrl && input === "a") {
    return {
      ...result(),
      state: { ...state, cursorOffset: 0 },
    };
  }

  // Ctrl+E → move to line end
  if (key.ctrl && input === "e") {
    return {
      ...result(),
      state: { ...state, cursorOffset: value.length },
    };
  }

  // Ctrl+H → backspace (readline convention)
  if (key.ctrl && input === "h") {
    if (state.cursorOffset > 0) {
      const newValue = value.slice(0, state.cursorOffset - 1) + value.slice(state.cursorOffset);
      return {
        ...result(),
        state: { ...state, cursorOffset: state.cursorOffset - 1 },
        value: newValue,
      };
    }
    return result();
  }

  // Ctrl+D → delete char at cursor (readline convention)
  if (key.ctrl && input === "d") {
    if (state.cursorOffset < value.length) {
      const newValue = value.slice(0, state.cursorOffset) + value.slice(state.cursorOffset + 1);
      return {
        ...result(),
        value: newValue,
      };
    }
    return result();
  }

  // Ctrl+T → transpose chars before cursor
  if (key.ctrl && input === "t") {
    if (state.cursorOffset >= 2) {
      const chars = value.split("");
      const tmp = chars[state.cursorOffset - 2]!;
      chars[state.cursorOffset - 2] = chars[state.cursorOffset - 1]!;
      chars[state.cursorOffset - 1] = tmp;
      return {
        ...result(),
        value: chars.join(""),
      };
    }
    return result();
  }

  // Ctrl+L → pass through to parent (clear/refresh)
  if (key.ctrl && input === "l") {
    return { ...result(), passThrough: true };
  }

  // Alt+F → forward word (meta + not escape + input === "f")
  if (key.meta && !key.escape && input === "f") {
    const newOffset = clampInsert(findNextWordStart(value, state.cursorOffset), value.length);
    return {
      ...result(),
      state: { ...state, cursorOffset: newOffset },
    };
  }

  // Alt+B → backward word
  if (key.meta && !key.escape && input === "b") {
    const newOffset = findPrevWordStart(value, state.cursorOffset);
    return {
      ...result(),
      state: { ...state, cursorOffset: newOffset },
    };
  }

  // Left arrow
  if (key.leftArrow) {
    const newOffset = clampInsert(state.cursorOffset - 1, value.length);
    return {
      ...result(),
      state: { ...state, cursorOffset: newOffset },
    };
  }

  // Right arrow
  if (key.rightArrow) {
    const newOffset = clampInsert(state.cursorOffset + 1, value.length);
    return {
      ...result(),
      state: { ...state, cursorOffset: newOffset },
    };
  }

  // Backspace
  if (key.backspace || key.delete) {
    if (state.cursorOffset > 0) {
      const newValue = value.slice(0, state.cursorOffset - 1) + value.slice(state.cursorOffset);
      return {
        ...result(),
        state: { ...state, cursorOffset: state.cursorOffset - 1 },
        value: newValue,
      };
    }
    return result();
  }

  // Printable character insertion
  if (input.length > 0 && !key.ctrl && !key.meta) {
    const newValue =
      value.slice(0, state.cursorOffset) + input + value.slice(state.cursorOffset);
    return {
      ...result(),
      state: { ...state, cursorOffset: state.cursorOffset + input.length },
      value: newValue,
    };
  }

  return result();
}

// ── Repeat last f/t/F/T helper ─────────────────────────────────

function repeatLastFind(
  state: VimState,
  value: string,
  result: () => VimResult,
  reverse: boolean,
): VimResult {
  const lf = state.lastFind;
  if (!lf) return result();

  const effectiveDir = reverse
    ? (lf.dir === "forward" ? "backward" : "forward")
    : lf.dir;

  // For non-inclusive finds (t/T), bump search position to skip adjacent char
  let searchPos = state.cursorOffset;
  if (!lf.inclusive) {
    if (effectiveDir === "forward") searchPos++;
    else searchPos--;
  }

  const idx = effectiveDir === "forward"
    ? findCharForward(value, searchPos, lf.char)
    : findCharBackward(value, searchPos, lf.char);

  if (idx < 0) return result();

  let target: number;
  if (effectiveDir === "forward") {
    target = lf.inclusive ? idx : idx - 1;
  } else {
    target = lf.inclusive ? idx : idx + 1;
  }
  return {
    ...result(),
    state: { ...state, cursorOffset: clampNormal(target, value.length) },
  };
}

// ── Normal mode ────────────────────────────────────────────────

function processNormal(
  input: string,
  key: Key,
  state: VimState,
  value: string,
): VimResult {
  const result = (): VimResult => ({
    state,
    value,
    escaped: false,
    submitted: false,
    passThrough: false,
  });

  // Pass-through keys
  if (key.tab || key.upArrow || key.downArrow || (key.ctrl && input === "c")) {
    return { ...result(), passThrough: true };
  }

  // Enter → submit from normal mode too
  if (key.return) {
    return { ...result(), submitted: true };
  }

  // ── Pending operator state machine ──────────────────────────

  if (state.pending !== null) {
    return processPending(input, key, state, value);
  }

  // ── Escape → propagate to parent ────────────────────────────

  if (key.escape) {
    return { ...result(), escaped: true };
  }

  // ── Motions ─────────────────────────────────────────────────

  // h / left arrow
  if (input === "h" || key.leftArrow) {
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(state.cursorOffset - 1, value.length) },
    };
  }

  // l / right arrow
  if (input === "l" || key.rightArrow) {
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(state.cursorOffset + 1, value.length) },
    };
  }

  // 0 → line start
  if (input === "0") {
    return {
      ...result(),
      state: { ...state, cursorOffset: 0 },
    };
  }

  // $ → line end
  if (input === "$") {
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(value.length - 1, value.length) },
    };
  }

  // w → next word start
  if (input === "w") {
    const next = findNextWordStart(value, state.cursorOffset);
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(next, value.length) },
    };
  }

  // b → prev word start
  if (input === "b") {
    const prev = findPrevWordStart(value, state.cursorOffset);
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(prev, value.length) },
    };
  }

  // W → next WORD start
  if (input === "W") {
    const next = findNextWORDStart(value, state.cursorOffset);
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(next, value.length) },
    };
  }

  // B → previous WORD start
  if (input === "B") {
    const prev = findPrevWORDStart(value, state.cursorOffset);
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(prev, value.length) },
    };
  }

  // e → end of word
  if (input === "e") {
    const end = findWordEnd(value, state.cursorOffset);
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(end, value.length) },
    };
  }

  // ; → repeat last f/t/F/T search
  if (input === ";") {
    return repeatLastFind(state, value, result, false);
  }

  // , → repeat last f/t/F/T search in opposite direction
  if (input === ",") {
    return repeatLastFind(state, value, result, true);
  }

  // ~ → toggle case of char at cursor, move right
  if (input === "~") {
    if (value.length === 0) return result();
    const ch = value[state.cursorOffset]!;
    const toggled = ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
    const newValue = value.slice(0, state.cursorOffset) + toggled + value.slice(state.cursorOffset + 1);
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(state.cursorOffset + 1, newValue.length) },
      value: newValue,
    };
  }

  // ── Mode switches ──────────────────────────────────────────

  // i → insert at cursor
  if (input === "i") {
    return {
      ...result(),
      state: { mode: "insert", cursorOffset: state.cursorOffset, pending: null },
    };
  }

  // I → insert at line start
  if (input === "I") {
    return {
      ...result(),
      state: { mode: "insert", cursorOffset: 0, pending: null },
    };
  }

  // a → insert after cursor
  if (input === "a") {
    return {
      ...result(),
      state: {
        mode: "insert",
        cursorOffset: clampInsert(state.cursorOffset + 1, value.length),
        pending: null,
      },
    };
  }

  // A → insert at end of line
  if (input === "A") {
    return {
      ...result(),
      state: { mode: "insert", cursorOffset: value.length, pending: null },
    };
  }

  // s → substitute (delete char + insert)
  if (input === "s") {
    if (value.length === 0) {
      return {
        ...result(),
        state: { mode: "insert", cursorOffset: 0, pending: null },
      };
    }
    const newValue = value.slice(0, state.cursorOffset) + value.slice(state.cursorOffset + 1);
    const newOffset = clampInsert(state.cursorOffset, newValue.length);
    return {
      ...result(),
      state: { mode: "insert", cursorOffset: newOffset, pending: null },
      value: newValue,
    };
  }

  // S → substitute entire line (like cc)
  if (input === "S") {
    return {
      ...result(),
      state: { mode: "insert", cursorOffset: 0, pending: null },
      value: "",
    };
  }

  // x → delete char at cursor
  if (input === "x") {
    if (value.length === 0) return result();
    const newValue = value.slice(0, state.cursorOffset) + value.slice(state.cursorOffset + 1);
    const newOffset = clampNormal(state.cursorOffset, newValue.length);
    return {
      ...result(),
      state: { ...state, cursorOffset: newOffset },
      value: newValue,
    };
  }

  // D → delete to end of line (like d$)
  if (input === "D") {
    const newValue = value.slice(0, state.cursorOffset);
    return {
      ...result(),
      state: { ...state, cursorOffset: clampNormal(state.cursorOffset, newValue.length) },
      value: newValue,
    };
  }

  // C → change to end of line (like c$)
  if (input === "C") {
    const newValue = value.slice(0, state.cursorOffset);
    return {
      ...result(),
      state: { mode: "insert", cursorOffset: clampInsert(state.cursorOffset, newValue.length), pending: null },
      value: newValue,
    };
  }

  // ── Operators (set pending) ─────────────────────────────────

  // d → start delete operator
  if (input === "d") {
    return {
      ...result(),
      state: { ...state, pending: { kind: "d" } },
    };
  }

  // c → start change operator
  if (input === "c") {
    return {
      ...result(),
      state: { ...state, pending: { kind: "c" } },
    };
  }

  // r → replace single char (pending)
  if (input === "r") {
    return {
      ...result(),
      state: { ...state, pending: { kind: "r" } },
    };
  }

  // g → prefix for ge, gi, etc. (pending)
  if (input === "g") {
    return {
      ...result(),
      state: { ...state, pending: { kind: "g" } },
    };
  }

  // f → find char forward (standalone motion)
  if (input === "f") {
    return {
      ...result(),
      state: { ...state, pending: { kind: "f" } },
    };
  }

  // t → till char forward (standalone motion)
  if (input === "t") {
    return {
      ...result(),
      state: { ...state, pending: { kind: "t" } },
    };
  }

  // F → find char backward (standalone motion)
  if (input === "F") {
    return {
      ...result(),
      state: { ...state, pending: { kind: "F" } },
    };
  }

  // T → till char backward (standalone motion)
  if (input === "T") {
    return {
      ...result(),
      state: { ...state, pending: { kind: "T" } },
    };
  }

  // Unrecognized key in normal mode — ignore
  return result();
}

// ── Operator-pending processing ────────────────────────────────

function processPending(
  input: string,
  key: Key,
  state: VimState,
  value: string,
): VimResult {
  const result = (): VimResult => ({
    state,
    value,
    escaped: false,
    submitted: false,
    passThrough: false,
  });
  const pending = state.pending!;

  // Escape → cancel pending
  if (key.escape) {
    return {
      ...result(),
      state: { ...state, pending: null },
    };
  }

  // ── Standalone f/t (just motions, not operators) ────────────

  // ── d{motion} ──────────────────────────────────────────────

  if (pending.kind === "d") {
    // dd → clear entire line
    if (input === "d") {
      return {
        ...result(),
        state: { ...state, cursorOffset: 0, pending: null },
        value: "",
      };
    }

    // d + f → wait for char
    if (input === "f") {
      return {
        ...result(),
        state: { ...state, pending: { kind: "df" } },
      };
    }

    // d + t → wait for char
    if (input === "t") {
      return {
        ...result(),
        state: { ...state, pending: { kind: "dt" } },
      };
    }

    // d + F → wait for char (backward)
    if (input === "F") {
      return {
        ...result(),
        state: { ...state, pending: { kind: "dF" } },
      };
    }

    // d + T → wait for char (backward)
    if (input === "T") {
      return {
        ...result(),
        state: { ...state, pending: { kind: "dT" } },
      };
    }

    // d + motion → compute range, delete
    const range = motionRange(input, key, state.cursorOffset, value);
    if (range) {
      const [from, to] = range;
      const newValue = value.slice(0, from) + value.slice(to);
      return {
        ...result(),
        state: { ...state, cursorOffset: clampNormal(from, newValue.length), pending: null },
        value: newValue,
      };
    }

    // Unknown key → cancel pending
    return {
      ...result(),
      state: { ...state, pending: null },
    };
  }

  // ── c{motion} ──────────────────────────────────────────────

  if (pending.kind === "c") {
    // cc → clear entire line, enter insert
    if (input === "c") {
      return {
        ...result(),
        state: { mode: "insert", cursorOffset: 0, pending: null },
        value: "",
      };
    }

    // c + f → wait for char
    if (input === "f") {
      return {
        ...result(),
        state: { ...state, pending: { kind: "cf" } },
      };
    }

    // c + t → wait for char
    if (input === "t") {
      return {
        ...result(),
        state: { ...state, pending: { kind: "ct" } },
      };
    }

    // c + F → wait for char (backward)
    if (input === "F") {
      return {
        ...result(),
        state: { ...state, pending: { kind: "cF" } },
      };
    }

    // c + T → wait for char (backward)
    if (input === "T") {
      return {
        ...result(),
        state: { ...state, pending: { kind: "cT" } },
      };
    }

    // c + motion → compute range, delete, insert mode
    const range = motionRange(input, key, state.cursorOffset, value);
    if (range) {
      const [from, to] = range;
      const newValue = value.slice(0, from) + value.slice(to);
      return {
        ...result(),
        state: { mode: "insert", cursorOffset: clampInsert(from, newValue.length), pending: null },
        value: newValue,
      };
    }

    // Unknown key → cancel pending
    return {
      ...result(),
      state: { ...state, pending: null },
    };
  }

  // ── r{char} — replace single character ────────────────────

  if (pending.kind === "r") {
    if (value.length === 0 || input.length === 0) {
      return { ...result(), state: { ...state, pending: null } };
    }
    const newValue = value.slice(0, state.cursorOffset) + input + value.slice(state.cursorOffset + 1);
    return {
      ...result(),
      state: { ...state, pending: null },
      value: newValue,
    };
  }

  // ── g{key} — g-prefix commands ──────────────────────────

  if (pending.kind === "g") {
    // ge → end of previous word
    if (input === "e") {
      const end = findPrevWordEnd(value, state.cursorOffset);
      return {
        ...result(),
        state: { ...state, cursorOffset: clampNormal(end, value.length), pending: null },
      };
    }

    // gi → resume insert at last position
    if (input === "i") {
      const offset = state.lastInsertOffset ?? value.length;
      return {
        ...result(),
        state: {
          mode: "insert",
          cursorOffset: clampInsert(offset, value.length),
          pending: null,
          lastFind: state.lastFind,
          lastInsertOffset: state.lastInsertOffset,
        },
      };
    }

    // Unknown g-command → cancel
    return { ...result(), state: { ...state, pending: null } };
  }

  // ── Standalone f/t/F/T (motions, not operators) ────────────

  if (pending.kind === "f") {
    const idx = findCharForward(value, state.cursorOffset, input);
    if (idx >= 0) {
      return {
        ...result(),
        state: {
          ...state,
          cursorOffset: clampNormal(idx, value.length),
          pending: null,
          lastFind: { dir: "forward", inclusive: true, char: input },
        },
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  if (pending.kind === "t") {
    const idx = findCharForward(value, state.cursorOffset, input);
    if (idx >= 0) {
      return {
        ...result(),
        state: {
          ...state,
          cursorOffset: clampNormal(idx - 1, value.length),
          pending: null,
          lastFind: { dir: "forward", inclusive: false, char: input },
        },
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  if (pending.kind === "F") {
    const idx = findCharBackward(value, state.cursorOffset, input);
    if (idx >= 0) {
      return {
        ...result(),
        state: {
          ...state,
          cursorOffset: clampNormal(idx, value.length),
          pending: null,
          lastFind: { dir: "backward", inclusive: true, char: input },
        },
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  if (pending.kind === "T") {
    const idx = findCharBackward(value, state.cursorOffset, input);
    if (idx >= 0) {
      return {
        ...result(),
        state: {
          ...state,
          cursorOffset: clampNormal(idx + 1, value.length),
          pending: null,
          lastFind: { dir: "backward", inclusive: false, char: input },
        },
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  // ── df{char} / dt{char} — delete + find/till forward ──────

  if (pending.kind === "df") {
    const idx = findCharForward(value, state.cursorOffset, input);
    if (idx >= 0) {
      const newValue = value.slice(0, state.cursorOffset) + value.slice(idx + 1);
      return {
        ...result(),
        state: {
          ...state,
          cursorOffset: clampNormal(state.cursorOffset, newValue.length),
          pending: null,
          lastFind: { dir: "forward", inclusive: true, char: input },
        },
        value: newValue,
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  if (pending.kind === "dt") {
    const idx = findCharForward(value, state.cursorOffset, input);
    if (idx >= 0) {
      const newValue = value.slice(0, state.cursorOffset) + value.slice(idx);
      return {
        ...result(),
        state: {
          ...state,
          cursorOffset: clampNormal(state.cursorOffset, newValue.length),
          pending: null,
          lastFind: { dir: "forward", inclusive: false, char: input },
        },
        value: newValue,
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  // ── dF{char} / dT{char} — delete + find/till backward ─────

  if (pending.kind === "dF") {
    const idx = findCharBackward(value, state.cursorOffset, input);
    if (idx >= 0) {
      const newValue = value.slice(0, idx) + value.slice(state.cursorOffset);
      return {
        ...result(),
        state: {
          ...state,
          cursorOffset: clampNormal(idx, newValue.length),
          pending: null,
          lastFind: { dir: "backward", inclusive: true, char: input },
        },
        value: newValue,
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  if (pending.kind === "dT") {
    const idx = findCharBackward(value, state.cursorOffset, input);
    if (idx >= 0) {
      const newValue = value.slice(0, idx + 1) + value.slice(state.cursorOffset);
      return {
        ...result(),
        state: {
          ...state,
          cursorOffset: clampNormal(idx + 1, newValue.length),
          pending: null,
          lastFind: { dir: "backward", inclusive: false, char: input },
        },
        value: newValue,
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  // ── cf{char} / ct{char} — change + find/till forward ──────

  if (pending.kind === "cf") {
    const idx = findCharForward(value, state.cursorOffset, input);
    if (idx >= 0) {
      const newValue = value.slice(0, state.cursorOffset) + value.slice(idx + 1);
      return {
        ...result(),
        state: {
          mode: "insert",
          cursorOffset: clampInsert(state.cursorOffset, newValue.length),
          pending: null,
          lastFind: { dir: "forward", inclusive: true, char: input },
        },
        value: newValue,
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  if (pending.kind === "ct") {
    const idx = findCharForward(value, state.cursorOffset, input);
    if (idx >= 0) {
      const newValue = value.slice(0, state.cursorOffset) + value.slice(idx);
      return {
        ...result(),
        state: {
          mode: "insert",
          cursorOffset: clampInsert(state.cursorOffset, newValue.length),
          pending: null,
          lastFind: { dir: "forward", inclusive: false, char: input },
        },
        value: newValue,
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  // ── cF{char} / cT{char} — change + find/till backward ─────

  if (pending.kind === "cF") {
    const idx = findCharBackward(value, state.cursorOffset, input);
    if (idx >= 0) {
      const newValue = value.slice(0, idx) + value.slice(state.cursorOffset);
      return {
        ...result(),
        state: {
          mode: "insert",
          cursorOffset: clampInsert(idx, newValue.length),
          pending: null,
          lastFind: { dir: "backward", inclusive: true, char: input },
        },
        value: newValue,
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  if (pending.kind === "cT") {
    const idx = findCharBackward(value, state.cursorOffset, input);
    if (idx >= 0) {
      const newValue = value.slice(0, idx + 1) + value.slice(state.cursorOffset);
      return {
        ...result(),
        state: {
          mode: "insert",
          cursorOffset: clampInsert(idx + 1, newValue.length),
          pending: null,
          lastFind: { dir: "backward", inclusive: false, char: input },
        },
        value: newValue,
      };
    }
    return { ...result(), state: { ...state, pending: null } };
  }

  // Fallback: cancel pending
  return {
    ...result(),
    state: { ...state, pending: null },
  };
}

/** Compute the [from, to) range for a motion key from the given cursor position. */
function motionRange(
  input: string,
  key: Key,
  cursor: number,
  value: string,
): [number, number] | null {
  // h / left
  if (input === "h" || key.leftArrow) {
    if (cursor > 0) return [cursor - 1, cursor];
    return null;
  }

  // l / right
  if (input === "l" || key.rightArrow) {
    if (cursor < value.length) return [cursor, cursor + 1];
    return null;
  }

  // w → delete to next word start
  if (input === "w") {
    const next = findNextWordStart(value, cursor);
    if (next > cursor) return [cursor, next];
    return null;
  }

  // b → delete backward to prev word start
  if (input === "b") {
    const prev = findPrevWordStart(value, cursor);
    if (prev < cursor) return [prev, cursor];
    return null;
  }

  // W → delete to next WORD start
  if (input === "W") {
    const next = findNextWORDStart(value, cursor);
    if (next > cursor) return [cursor, next];
    return null;
  }

  // B → delete to previous WORD start
  if (input === "B") {
    const prev = findPrevWORDStart(value, cursor);
    if (prev < cursor) return [prev, cursor];
    return null;
  }

  // 0 → delete to line start
  if (input === "0") {
    if (cursor > 0) return [0, cursor];
    return null;
  }

  // e → delete to end of word (inclusive)
  if (input === "e") {
    const end = findWordEnd(value, cursor);
    if (end >= cursor && cursor < value.length) return [cursor, end + 1];
    return null;
  }

  // $ → delete to line end (inclusive)
  if (input === "$") {
    if (cursor < value.length) return [cursor, value.length];
    return null;
  }

  return null;
}

