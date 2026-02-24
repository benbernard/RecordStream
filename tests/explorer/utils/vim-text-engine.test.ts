import { describe, test, expect } from "bun:test";
import {
  processInput,
  initialState,
  charClass,
  findNextWordStart,
  findPrevWordStart,
  findNextWORDStart,
  findPrevWORDStart,
  findCharForward,
  findCharBackward,
  findWordEnd,
  findPrevWordEnd,
  type VimState,
} from "../../../src/explorer/utils/vim-text-engine.ts";
import type { Key } from "ink";

// ── Helpers ──────────────────────────────────────────────────

/** Create a default Key object with all flags false. */
function makeKey(overrides: Partial<Key> = {}): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    super: false,
    hyper: false,
    capsLock: false,
    numLock: false,
    ...overrides,
  };
}

/** Shorthand: press a printable key in a given state. */
function press(input: string, state: VimState, value: string, keyOverrides: Partial<Key> = {}) {
  return processInput(input, makeKey(keyOverrides), state, value);
}

// ── charClass ────────────────────────────────────────────────

describe("charClass", () => {
  test("classifies word characters", () => {
    expect(charClass("a")).toBe("word");
    expect(charClass("Z")).toBe("word");
    expect(charClass("0")).toBe("word");
    expect(charClass("_")).toBe("word");
  });

  test("classifies punctuation", () => {
    expect(charClass("-")).toBe("punct");
    expect(charClass(".")).toBe("punct");
    expect(charClass("!")).toBe("punct");
    expect(charClass("(")).toBe("punct");
  });

  test("classifies whitespace", () => {
    expect(charClass(" ")).toBe("space");
    expect(charClass("\t")).toBe("space");
  });
});

// ── findNextWordStart ─────────────────────────────────────────

describe("findNextWordStart", () => {
  test("jumps past current word", () => {
    expect(findNextWordStart("hello world", 0)).toBe(6);
  });

  test("jumps past whitespace between words", () => {
    expect(findNextWordStart("hello world", 4)).toBe(6);
  });

  test("stops at punct boundary", () => {
    expect(findNextWordStart("foo.bar", 0)).toBe(3);
  });

  test("handles end of string", () => {
    expect(findNextWordStart("abc", 2)).toBe(3);
  });

  test("at end returns length", () => {
    expect(findNextWordStart("abc", 3)).toBe(3);
  });
});

// ── findPrevWordStart ─────────────────────────────────────────

describe("findPrevWordStart", () => {
  test("jumps back to start of current word", () => {
    expect(findPrevWordStart("hello world", 8)).toBe(6);
  });

  test("jumps back past whitespace", () => {
    expect(findPrevWordStart("hello world", 6)).toBe(0);
  });

  test("returns 0 at start", () => {
    expect(findPrevWordStart("hello", 0)).toBe(0);
  });

  test("handles punct boundary", () => {
    // "foo.bar": f(0) o(1) o(2) .(3) b(4) a(5) r(6)
    // from 4 ("b"): back past "." punct to start of punct run → 3
    expect(findPrevWordStart("foo.bar", 4)).toBe(3);
    // from 3 ("."): back past "foo" word to start → 0
    expect(findPrevWordStart("foo.bar", 3)).toBe(0);
  });
});

// ── findNextWORDStart ─────────────────────────────────────────

describe("findNextWORDStart", () => {
  test("jumps past WORD (whitespace-delimited)", () => {
    expect(findNextWORDStart("foo.bar baz", 0)).toBe(8);
  });

  test("from middle of WORD", () => {
    expect(findNextWORDStart("foo.bar baz", 2)).toBe(8);
  });
});

// ── findPrevWORDStart ─────────────────────────────────────────

describe("findPrevWORDStart", () => {
  test("jumps back past WORD (whitespace-delimited)", () => {
    expect(findPrevWORDStart("foo.bar baz", 8)).toBe(0);
  });

  test("from middle of WORD", () => {
    expect(findPrevWORDStart("foo.bar baz", 10)).toBe(8);
  });

  test("at start returns 0", () => {
    expect(findPrevWORDStart("hello world", 0)).toBe(0);
  });

  test("treats punctuation as part of WORD", () => {
    expect(findPrevWORDStart("abc --key val", 10)).toBe(4);
  });
});

// ── findCharForward ───────────────────────────────────────────

describe("findCharForward", () => {
  test("finds character forward", () => {
    expect(findCharForward("hello world", 0, "o")).toBe(4);
  });

  test("returns -1 when not found", () => {
    expect(findCharForward("hello", 0, "z")).toBe(-1);
  });

  test("searches after current position", () => {
    expect(findCharForward("abcabc", 0, "a")).toBe(3);
  });
});

// ── Insert mode ──────────────────────────────────────────────

describe("insert mode", () => {
  test("starts in insert mode", () => {
    const state = initialState(0);
    expect(state.mode).toBe("insert");
  });

  test("inserts printable characters", () => {
    const state = initialState(0);
    const r = press("a", state, "");
    expect(r.value).toBe("a");
    expect(r.state.cursorOffset).toBe(1);
  });

  test("inserts at cursor position", () => {
    const state: VimState = { mode: "insert", cursorOffset: 3, pending: null };
    const r = press("X", state, "hello");
    expect(r.value).toBe("helXlo");
    expect(r.state.cursorOffset).toBe(4);
  });

  test("backspace deletes backward", () => {
    const state: VimState = { mode: "insert", cursorOffset: 3, pending: null };
    const r = press("", state, "hello", { backspace: true });
    expect(r.value).toBe("helo");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("backspace at start does nothing", () => {
    const state: VimState = { mode: "insert", cursorOffset: 0, pending: null };
    const r = press("", state, "hello", { backspace: true });
    expect(r.value).toBe("hello");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("left arrow moves cursor left", () => {
    const state: VimState = { mode: "insert", cursorOffset: 3, pending: null };
    const r = press("", state, "hello", { leftArrow: true });
    expect(r.state.cursorOffset).toBe(2);
  });

  test("right arrow moves cursor right", () => {
    const state: VimState = { mode: "insert", cursorOffset: 3, pending: null };
    const r = press("", state, "hello", { rightArrow: true });
    expect(r.state.cursorOffset).toBe(4);
  });

  test("Ctrl+U clears entire line", () => {
    const state: VimState = { mode: "insert", cursorOffset: 3, pending: null };
    const r = press("u", state, "hello", { ctrl: true });
    expect(r.value).toBe("");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("Ctrl+K clears from cursor to end", () => {
    const state: VimState = { mode: "insert", cursorOffset: 2, pending: null };
    const r = press("k", state, "hello", { ctrl: true });
    expect(r.value).toBe("he");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("Ctrl+W deletes backward word", () => {
    const state: VimState = { mode: "insert", cursorOffset: 11, pending: null };
    const r = press("w", state, "hello world", { ctrl: true });
    expect(r.value).toBe("hello ");
    expect(r.state.cursorOffset).toBe(6);
  });

  test("Alt+F moves forward by word", () => {
    const state: VimState = { mode: "insert", cursorOffset: 0, pending: null };
    const r = press("f", state, "hello world", { meta: true });
    expect(r.state.cursorOffset).toBe(6);
  });

  test("Alt+B moves backward by word", () => {
    const state: VimState = { mode: "insert", cursorOffset: 8, pending: null };
    const r = press("b", state, "hello world", { meta: true });
    expect(r.state.cursorOffset).toBe(6);
  });

  test("Enter submits", () => {
    const state: VimState = { mode: "insert", cursorOffset: 5, pending: null };
    const r = press("", state, "hello", { return: true });
    expect(r.submitted).toBe(true);
  });

  test("Escape switches to normal mode", () => {
    const state: VimState = { mode: "insert", cursorOffset: 3, pending: null };
    const r = press("", state, "hello", { escape: true });
    expect(r.state.mode).toBe("normal");
    expect(r.state.cursorOffset).toBe(2); // cursor moves left 1
    expect(r.escaped).toBe(false); // NOT propagated
  });

  test("Escape at offset 0 clamps to 0", () => {
    const state: VimState = { mode: "insert", cursorOffset: 0, pending: null };
    const r = press("", state, "hello", { escape: true });
    expect(r.state.cursorOffset).toBe(0);
  });

  test("Tab passes through", () => {
    const state: VimState = { mode: "insert", cursorOffset: 0, pending: null };
    const r = press("", state, "hello", { tab: true });
    expect(r.passThrough).toBe(true);
  });

  test("Up/Down arrows pass through", () => {
    const state: VimState = { mode: "insert", cursorOffset: 0, pending: null };
    expect(press("", state, "hello", { upArrow: true }).passThrough).toBe(true);
    expect(press("", state, "hello", { downArrow: true }).passThrough).toBe(true);
  });

  test("Ctrl+C passes through", () => {
    const state: VimState = { mode: "insert", cursorOffset: 0, pending: null };
    const r = press("c", state, "hello", { ctrl: true });
    expect(r.passThrough).toBe(true);
  });
});

// ── Normal mode ──────────────────────────────────────────────

describe("normal mode", () => {
  test("h moves cursor left", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    const r = press("h", state, "hello");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("h clamps at 0", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("h", state, "hello");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("l moves cursor right", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    const r = press("l", state, "hello");
    expect(r.state.cursorOffset).toBe(3);
  });

  test("l clamps at len-1", () => {
    const state: VimState = { mode: "normal", cursorOffset: 4, pending: null };
    const r = press("l", state, "hello");
    expect(r.state.cursorOffset).toBe(4);
  });

  test("0 moves to line start", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    const r = press("0", state, "hello");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("$ moves to line end", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("$", state, "hello");
    expect(r.state.cursorOffset).toBe(4);
  });

  test("w moves to next word start", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("w", state, "hello world");
    expect(r.state.cursorOffset).toBe(6);
  });

  test("b moves to prev word start", () => {
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    const r = press("b", state, "hello world");
    expect(r.state.cursorOffset).toBe(6);
  });

  test("W moves to next WORD start", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("W", state, "foo.bar baz");
    expect(r.state.cursorOffset).toBe(8);
  });

  test("B moves to previous WORD start", () => {
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    const r = press("B", state, "foo.bar baz");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("i enters insert mode at cursor", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    const r = press("i", state, "hello");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(3);
  });

  test("a enters insert mode after cursor", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    const r = press("a", state, "hello");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(4);
  });

  test("A enters insert mode at end of line", () => {
    const state: VimState = { mode: "normal", cursorOffset: 1, pending: null };
    const r = press("A", state, "hello");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(5);
  });

  test("s substitutes char and enters insert", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    const r = press("s", state, "hello");
    expect(r.state.mode).toBe("insert");
    expect(r.value).toBe("helo");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("s on empty value enters insert", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("s", state, "");
    expect(r.state.mode).toBe("insert");
    expect(r.value).toBe("");
  });

  test("x deletes char at cursor", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    const r = press("x", state, "hello");
    expect(r.value).toBe("helo");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("x on last char clamps cursor", () => {
    const state: VimState = { mode: "normal", cursorOffset: 4, pending: null };
    const r = press("x", state, "hello");
    expect(r.value).toBe("hell");
    expect(r.state.cursorOffset).toBe(3); // clamps to new len-1
  });

  test("x on empty value does nothing", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("x", state, "");
    expect(r.value).toBe("");
  });

  test("Escape with no pending propagates (escaped=true)", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    const r = press("", state, "hello", { escape: true });
    expect(r.escaped).toBe(true);
  });

  test("Enter submits from normal mode", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    const r = press("", state, "hello", { return: true });
    expect(r.submitted).toBe(true);
  });

  test("Tab passes through", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("", state, "hello", { tab: true });
    expect(r.passThrough).toBe(true);
  });
});

// ── D (delete to end of line) ────────────────────────────────

describe("D (delete to end of line)", () => {
  test("D deletes from cursor to end of line", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    const r = press("D", state, "hello world");
    expect(r.value).toBe("hel");
    expect(r.state.cursorOffset).toBe(2); // clampNormal on "hel" → 2
    expect(r.state.mode).toBe("normal");
  });

  test("D at start deletes entire line", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("D", state, "hello");
    expect(r.value).toBe("");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("D at last char deletes that char", () => {
    const state: VimState = { mode: "normal", cursorOffset: 4, pending: null };
    const r = press("D", state, "hello");
    expect(r.value).toBe("hell");
    expect(r.state.cursorOffset).toBe(3);
  });

  test("D on empty value does nothing", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("D", state, "");
    expect(r.value).toBe("");
    expect(r.state.cursorOffset).toBe(0);
  });
});

// ── C (change to end of line) ────────────────────────────────

describe("C (change to end of line)", () => {
  test("C deletes from cursor to end and enters insert mode", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    const r = press("C", state, "hello world");
    expect(r.value).toBe("hel");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(3); // insert cursor at end of remaining text
  });

  test("C at start clears line and enters insert", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("C", state, "hello");
    expect(r.value).toBe("");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("C at last char deletes it and enters insert", () => {
    const state: VimState = { mode: "normal", cursorOffset: 4, pending: null };
    const r = press("C", state, "hello");
    expect(r.value).toBe("hell");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(4);
  });

  test("C on empty value enters insert", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("C", state, "");
    expect(r.value).toBe("");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(0);
  });
});

// ── d operator ───────────────────────────────────────────────

describe("d operator", () => {
  test("dd clears entire line", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    let r = press("d", state, "hello");
    expect(r.state.pending).toEqual({ kind: "d" });

    r = press("d", r.state, r.value);
    expect(r.value).toBe("");
    expect(r.state.cursorOffset).toBe(0);
    expect(r.state.pending).toBeNull();
  });

  test("dw deletes to next word start", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("d", state, "hello world");
    r = press("w", r.state, r.value);
    expect(r.value).toBe("world");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("db deletes backward to prev word start", () => {
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    let r = press("d", state, "hello world");
    r = press("b", r.state, r.value);
    expect(r.value).toBe("hello rld");
    expect(r.state.cursorOffset).toBe(6);
  });

  test("dB deletes backward to prev WORD start", () => {
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    let r = press("d", state, "foo.bar baz");
    r = press("B", r.state, r.value);
    expect(r.value).toBe("baz");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("d$ deletes to end of line", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    let r = press("d", state, "hello");
    r = press("$", r.state, r.value);
    expect(r.value).toBe("hel");
  });

  test("d0 deletes to start of line", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    let r = press("d", state, "hello");
    r = press("0", r.state, r.value);
    expect(r.value).toBe("lo");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("dh deletes character to the left", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    let r = press("d", state, "hello");
    r = press("h", r.state, r.value);
    expect(r.value).toBe("helo");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("dl deletes character at cursor", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    let r = press("d", state, "hello");
    r = press("l", r.state, r.value);
    expect(r.value).toBe("helo");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("df{char} deletes through character", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("d", state, "hello world");
    r = press("f", r.state, r.value);
    expect(r.state.pending).toEqual({ kind: "df" });
    r = press("o", r.state, r.value);
    expect(r.value).toBe(" world");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("dt{char} deletes till character", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("d", state, "hello world");
    r = press("t", r.state, r.value);
    expect(r.state.pending).toEqual({ kind: "dt" });
    r = press("o", r.state, r.value);
    expect(r.value).toBe("o world");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("d + unknown key cancels pending", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    let r = press("d", state, "hello");
    r = press("z", r.state, r.value);
    expect(r.state.pending).toBeNull();
    expect(r.value).toBe("hello");
  });

  test("Escape cancels pending d", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    let r = press("d", state, "hello");
    r = press("", r.state, r.value, { escape: true });
    expect(r.state.pending).toBeNull();
    expect(r.escaped).toBe(false); // NOT propagated
  });
});

// ── c operator ───────────────────────────────────────────────

describe("c operator", () => {
  test("cc clears line and enters insert", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    let r = press("c", state, "hello");
    r = press("c", r.state, r.value);
    expect(r.value).toBe("");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("cw changes to next word start", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("c", state, "hello world");
    r = press("w", r.state, r.value);
    expect(r.value).toBe("world");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("cf{char} changes through character", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("c", state, "hello world");
    r = press("f", r.state, r.value);
    r = press("o", r.state, r.value);
    expect(r.value).toBe(" world");
    expect(r.state.mode).toBe("insert");
  });

  test("ct{char} changes till character", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("c", state, "hello world");
    r = press("t", r.state, r.value);
    r = press("o", r.state, r.value);
    expect(r.value).toBe("o world");
    expect(r.state.mode).toBe("insert");
  });
});

// ── f/t/F/T as standalone motions ─────────────────────────────

describe("standalone f/t/F/T motions in normal mode", () => {
  test("f{char} moves cursor to char", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("f", state, "hello world");
    expect(r.state.pending).toEqual({ kind: "f" });
    r = press("w", r.state, r.value);
    expect(r.state.cursorOffset).toBe(6);
    expect(r.state.pending).toBeNull();
    expect(r.value).toBe("hello world"); // no deletion
  });

  test("t{char} moves cursor to just before char", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("t", state, "hello world");
    expect(r.state.pending).toEqual({ kind: "t" });
    r = press("w", r.state, r.value);
    expect(r.state.cursorOffset).toBe(5);
    expect(r.value).toBe("hello world");
  });

  test("F{char} moves cursor backward to char", () => {
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    let r = press("F", state, "hello world");
    expect(r.state.pending).toEqual({ kind: "F" });
    r = press("e", r.state, r.value);
    expect(r.state.cursorOffset).toBe(1);
    expect(r.value).toBe("hello world");
  });

  test("T{char} moves cursor backward to just after char", () => {
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    let r = press("T", state, "hello world");
    expect(r.state.pending).toEqual({ kind: "T" });
    r = press("e", r.state, r.value);
    expect(r.state.cursorOffset).toBe(2);
    expect(r.value).toBe("hello world");
  });

  test("f{char} not found cancels pending", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("f", state, "hello");
    r = press("z", r.state, r.value);
    expect(r.state.pending).toBeNull();
    expect(r.state.cursorOffset).toBe(0);
  });

  test("f/t store lastFind for ; and ,", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("f", state, "abcabc");
    r = press("b", r.state, r.value);
    expect(r.state.lastFind).toEqual({ dir: "forward", inclusive: true, char: "b" });
  });
});

// ── findCharBackward ─────────────────────────────────────────

describe("findCharBackward", () => {
  test("finds character backward", () => {
    expect(findCharBackward("hello world", 5, "e")).toBe(1);
  });

  test("finds nearest char backward", () => {
    // "hello world": o at 4 and 7. From pos 8, nearest backward o is at 7.
    expect(findCharBackward("hello world", 8, "o")).toBe(7);
  });

  test("returns -1 when not found", () => {
    expect(findCharBackward("hello", 3, "z")).toBe(-1);
  });

  test("does not include current position", () => {
    expect(findCharBackward("aba", 2, "a")).toBe(0);
  });
});

// ── findWordEnd ──────────────────────────────────────────────

describe("findWordEnd", () => {
  test("jumps to end of current word", () => {
    expect(findWordEnd("hello world", 0)).toBe(4);
  });

  test("jumps to end of next word from end of current word", () => {
    expect(findWordEnd("hello world", 4)).toBe(10);
  });

  test("jumps to end of next word from whitespace", () => {
    expect(findWordEnd("hello world", 5)).toBe(10);
  });

  test("handles end of string", () => {
    expect(findWordEnd("abc", 2)).toBe(2);
  });

  test("stops at punct boundary", () => {
    expect(findWordEnd("foo.bar", 0)).toBe(2);
  });
});

// ── findPrevWordEnd ─────────────────────────────────────────

describe("findPrevWordEnd", () => {
  test("jumps to end of previous word from middle", () => {
    expect(findPrevWordEnd("hello world", 8)).toBe(4);
  });

  test("jumps to end of previous word from start of word", () => {
    expect(findPrevWordEnd("hello world", 6)).toBe(4);
  });

  test("returns 0 at start", () => {
    expect(findPrevWordEnd("hello", 0)).toBe(0);
  });

  test("from end of first word returns 0", () => {
    expect(findPrevWordEnd("hello world", 4)).toBe(0);
  });
});

// ── S (substitute entire line) ──────────────────────────────

describe("S (substitute entire line)", () => {
  test("S clears line and enters insert mode", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    const r = press("S", state, "hello world");
    expect(r.value).toBe("");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("S on empty value enters insert", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("S", state, "");
    expect(r.value).toBe("");
    expect(r.state.mode).toBe("insert");
  });
});

// ── I (insert at line start) ─────────────────────────────────

describe("I (insert at line start)", () => {
  test("I enters insert mode at start of line", () => {
    const state: VimState = { mode: "normal", cursorOffset: 5, pending: null };
    const r = press("I", state, "hello world");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(0);
  });
});

// ── r (replace single character) ─────────────────────────────

describe("r (replace single character)", () => {
  test("r{char} replaces char at cursor", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("r", state, "hello");
    expect(r.state.pending).toEqual({ kind: "r" });
    r = press("H", r.state, r.value);
    expect(r.value).toBe("Hello");
    expect(r.state.mode).toBe("normal");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("r on empty value cancels", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("r", state, "");
    r = press("x", r.state, r.value);
    expect(r.value).toBe("");
    expect(r.state.pending).toBeNull();
  });

  test("r replaces in middle of string", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    let r = press("r", state, "hello");
    r = press("L", r.state, r.value);
    expect(r.value).toBe("heLlo");
    expect(r.state.cursorOffset).toBe(2);
  });
});

// ── ~ (toggle case) ─────────────────────────────────────────

describe("~ (toggle case)", () => {
  test("toggles lowercase to uppercase and moves right", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("~", state, "hello");
    expect(r.value).toBe("Hello");
    expect(r.state.cursorOffset).toBe(1);
  });

  test("toggles uppercase to lowercase", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("~", state, "HELLO");
    expect(r.value).toBe("hELLO");
    expect(r.state.cursorOffset).toBe(1);
  });

  test("at last char clamps cursor", () => {
    const state: VimState = { mode: "normal", cursorOffset: 4, pending: null };
    const r = press("~", state, "hellO");
    expect(r.value).toBe("hello");
    expect(r.state.cursorOffset).toBe(4); // clampNormal at end
  });

  test("on empty value does nothing", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("~", state, "");
    expect(r.value).toBe("");
  });
});

// ── e (end of word) ──────────────────────────────────────────

describe("e (end of word motion)", () => {
  test("e moves to end of current word", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    const r = press("e", state, "hello world");
    expect(r.state.cursorOffset).toBe(4);
  });

  test("e from end of word moves to end of next word", () => {
    const state: VimState = { mode: "normal", cursorOffset: 4, pending: null };
    const r = press("e", state, "hello world");
    expect(r.state.cursorOffset).toBe(10);
  });

  test("de deletes to end of word", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("d", state, "hello world");
    r = press("e", r.state, r.value);
    expect(r.value).toBe(" world");
    expect(r.state.cursorOffset).toBe(0);
  });

  test("ce changes to end of word", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("c", state, "hello world");
    r = press("e", r.state, r.value);
    expect(r.value).toBe(" world");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(0);
  });
});

// ── ge (end of previous word) ────────────────────────────────

describe("ge (end of previous word)", () => {
  test("ge moves to end of previous word", () => {
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    let r = press("g", state, "hello world");
    expect(r.state.pending).toEqual({ kind: "g" });
    r = press("e", r.state, r.value);
    expect(r.state.cursorOffset).toBe(4);
    expect(r.state.pending).toBeNull();
  });

  test("ge at start of second word goes to end of first", () => {
    const state: VimState = { mode: "normal", cursorOffset: 6, pending: null };
    let r = press("g", state, "hello world");
    r = press("e", r.state, r.value);
    expect(r.state.cursorOffset).toBe(4);
  });

  test("ge at start returns 0", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("g", state, "hello");
    r = press("e", r.state, r.value);
    expect(r.state.cursorOffset).toBe(0);
  });

  test("g + unknown key cancels pending", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("g", state, "hello");
    r = press("z", r.state, r.value);
    expect(r.state.pending).toBeNull();
  });
});

// ── gi (resume insert at last position) ──────────────────────

describe("gi (resume insert at last position)", () => {
  test("gi resumes insert at last exit position", () => {
    // Type, escape (stores lastInsertOffset), move, then gi
    let state: VimState = { mode: "insert", cursorOffset: 3, pending: null };
    // Escape stores lastInsertOffset = 3
    let r = press("", state, "hello", { escape: true });
    expect(r.state.lastInsertOffset).toBe(3);
    // Move cursor
    r = press("$", r.state, r.value);
    expect(r.state.cursorOffset).toBe(4);
    // gi should go back to offset 3
    r = press("g", r.state, r.value);
    r = press("i", r.state, r.value);
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(3);
  });

  test("gi with no previous insert goes to end", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("g", state, "hello");
    r = press("i", r.state, r.value);
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(5); // value.length
  });
});

// ── ; and , (repeat last find) ───────────────────────────────

describe("; and , (repeat last find)", () => {
  test("; repeats last f search forward", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    // f → b finds first 'b' at 1
    let r = press("f", state, "abcabc");
    r = press("b", r.state, r.value);
    expect(r.state.cursorOffset).toBe(1);
    // ; repeats → finds next 'b' at 4
    r = press(";", r.state, r.value);
    expect(r.state.cursorOffset).toBe(4);
  });

  test(", reverses last f search (goes backward)", () => {
    const state: VimState = { mode: "normal", cursorOffset: 4, pending: null };
    // f → c finds 'c' at 5
    let r = press("f", state, "abcabc");
    r = press("c", r.state, r.value);
    expect(r.state.cursorOffset).toBe(5);
    // , reverses → goes backward, finds 'c' at 2
    r = press(",", r.state, r.value);
    expect(r.state.cursorOffset).toBe(2);
  });

  test("; with no previous find does nothing", () => {
    const state: VimState = { mode: "normal", cursorOffset: 3, pending: null };
    const r = press(";", state, "hello");
    expect(r.state.cursorOffset).toBe(3);
  });

  test("; repeats t search (non-inclusive)", () => {
    const state: VimState = { mode: "normal", cursorOffset: 0, pending: null };
    let r = press("t", state, "abcabc");
    r = press("c", r.state, r.value);
    expect(r.state.cursorOffset).toBe(1); // before first 'c' at 2
    // ; should repeat t → cursor before next 'c' at 5 → 4
    r = press(";", r.state, r.value);
    expect(r.state.cursorOffset).toBe(4);
  });
});

// ── F/T backward find operators ──────────────────────────────

describe("dF/dT/cF/cT (backward find operators)", () => {
  test("dF{char} deletes backward through char", () => {
    // "hello world" pos 8='r', find 'e' at 1
    // Deletes [1, 8) → "h" + "rld" = "hrld"
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    let r = press("d", state, "hello world");
    r = press("F", r.state, r.value);
    expect(r.state.pending).toEqual({ kind: "dF" });
    r = press("e", r.state, r.value);
    expect(r.value).toBe("hrld");
    expect(r.state.cursorOffset).toBe(1);
  });

  test("dT{char} deletes backward till char (exclusive)", () => {
    // "hello world" pos 8='r', find 'e' at 1, till = don't include 'e'
    // Deletes [2, 8) → "he" + "rld" = "herld"
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    let r = press("d", state, "hello world");
    r = press("T", r.state, r.value);
    expect(r.state.pending).toEqual({ kind: "dT" });
    r = press("e", r.state, r.value);
    expect(r.value).toBe("herld");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("cF{char} changes backward through char", () => {
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    let r = press("c", state, "hello world");
    r = press("F", r.state, r.value);
    r = press("e", r.state, r.value);
    expect(r.value).toBe("hrld");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(1);
  });

  test("cT{char} changes backward till char", () => {
    const state: VimState = { mode: "normal", cursorOffset: 8, pending: null };
    let r = press("c", state, "hello world");
    r = press("T", r.state, r.value);
    r = press("e", r.state, r.value);
    expect(r.value).toBe("herld");
    expect(r.state.mode).toBe("insert");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("dF not found cancels", () => {
    const state: VimState = { mode: "normal", cursorOffset: 5, pending: null };
    let r = press("d", state, "hello world");
    r = press("F", r.state, r.value);
    r = press("z", r.state, r.value);
    expect(r.value).toBe("hello world");
    expect(r.state.pending).toBeNull();
  });
});

// ── Insert mode readline shortcuts ───────────────────────────

describe("insert mode readline shortcuts", () => {
  test("Ctrl+A moves to line start", () => {
    const state: VimState = { mode: "insert", cursorOffset: 5, pending: null };
    const r = press("a", state, "hello", { ctrl: true });
    expect(r.state.cursorOffset).toBe(0);
    expect(r.value).toBe("hello");
  });

  test("Ctrl+E moves to line end", () => {
    const state: VimState = { mode: "insert", cursorOffset: 2, pending: null };
    const r = press("e", state, "hello", { ctrl: true });
    expect(r.state.cursorOffset).toBe(5);
    expect(r.value).toBe("hello");
  });

  test("Ctrl+H deletes backward (like backspace)", () => {
    const state: VimState = { mode: "insert", cursorOffset: 3, pending: null };
    const r = press("h", state, "hello", { ctrl: true });
    expect(r.value).toBe("helo");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("Ctrl+H at start does nothing", () => {
    const state: VimState = { mode: "insert", cursorOffset: 0, pending: null };
    const r = press("h", state, "hello", { ctrl: true });
    expect(r.value).toBe("hello");
  });

  test("Ctrl+D deletes char at cursor", () => {
    const state: VimState = { mode: "insert", cursorOffset: 2, pending: null };
    const r = press("d", state, "hello", { ctrl: true });
    expect(r.value).toBe("helo");
    expect(r.state.cursorOffset).toBe(2);
  });

  test("Ctrl+D at end does nothing", () => {
    const state: VimState = { mode: "insert", cursorOffset: 5, pending: null };
    const r = press("d", state, "hello", { ctrl: true });
    expect(r.value).toBe("hello");
  });

  test("Ctrl+T transposes characters before cursor", () => {
    const state: VimState = { mode: "insert", cursorOffset: 3, pending: null };
    const r = press("t", state, "teh", { ctrl: true });
    expect(r.value).toBe("the");
  });

  test("Ctrl+T at start (offset < 2) does nothing", () => {
    const state: VimState = { mode: "insert", cursorOffset: 1, pending: null };
    const r = press("t", state, "hello", { ctrl: true });
    expect(r.value).toBe("hello");
  });

  test("Ctrl+L passes through", () => {
    const state: VimState = { mode: "insert", cursorOffset: 0, pending: null };
    const r = press("l", state, "hello", { ctrl: true });
    expect(r.passThrough).toBe(true);
  });
});

// ── Integration: full editing sequences ──────────────────────

describe("integration sequences", () => {
  test("type, escape, dw, i, type more", () => {
    let state = initialState(0);
    let value = "";

    // Type "hello world"
    for (const ch of "hello world") {
      const r = press(ch, state, value);
      state = r.state;
      value = r.value;
    }
    expect(value).toBe("hello world");

    // Escape to normal
    let r = press("", state, value, { escape: true });
    state = r.state;
    expect(state.mode).toBe("normal");

    // Move to start with 0
    r = press("0", state, value);
    state = r.state;
    expect(state.cursorOffset).toBe(0);

    // dw → delete "hello "
    r = press("d", state, value);
    state = r.state;
    r = press("w", state, value);
    state = r.state;
    value = r.value;
    expect(value).toBe("world");

    // i → insert mode, type "hey "
    r = press("i", state, value);
    state = r.state;
    for (const ch of "hey ") {
      const r2 = press(ch, state, value);
      state = r2.state;
      value = r2.value;
    }
    expect(value).toBe("hey world");
  });

  test("double-escape propagates from normal mode", () => {
    let state = initialState(5);
    const value = "hello";

    // First escape: insert → normal (not propagated)
    let r = press("", state, value, { escape: true });
    state = r.state;
    expect(r.escaped).toBe(false);
    expect(state.mode).toBe("normal");

    // Second escape: normal → propagated
    r = press("", state, value, { escape: true });
    expect(r.escaped).toBe(true);
  });

  test("escape cancels pending operator, does not propagate", () => {
    const state: VimState = { mode: "normal", cursorOffset: 2, pending: null };
    // d → pending
    let r = press("d", state, "hello");
    expect(r.state.pending).not.toBeNull();

    // Escape → cancel pending, NOT propagated
    r = press("", r.state, r.value, { escape: true });
    expect(r.state.pending).toBeNull();
    expect(r.escaped).toBe(false);
  });

  test("Ctrl+W at word boundary", () => {
    const state: VimState = { mode: "insert", cursorOffset: 6, pending: null };
    const r = press("w", state, "hello world", { ctrl: true });
    expect(r.value).toBe("world");
    expect(r.state.cursorOffset).toBe(0);
  });
});
