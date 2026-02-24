#!/usr/bin/env python3
"""RecordStream Python snippet runner.

This script is spawned as a subprocess by the TypeScript host. It
communicates over stdin/stdout using the JSONL protocol defined in
``protocol.py``.

No external dependencies — stdlib only.
"""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any

# runner.py is invoked from the directory containing these modules,
# so a plain import works.
from recs_sdk import Record
from protocol import (
    VALID_MODES,
    MODE_EVAL,
    MODE_GREP,
    MODE_XFORM,
    MODE_GENERATE,
    MSG_DONE,
    MSG_RECORD,
    read_message,
    send_result,
    send_filter,
    send_emit,
    send_record_done,
    send_error,
)


def _compile_snippet(code: str, mode: str) -> Any:
    """Compile user code into a code object.

    For *grep* mode the code is always compiled as an expression.
    For *eval* mode we first try ``exec`` (statements); if that fails
    we fall back to ``eval`` (single expression).
    For *xform* and *generate* modes the code is compiled as ``exec``
    so the user can call ``emit()`` freely.

    Returns:
        A tuple ``(code_object, is_expression)``.
    """
    if mode == MODE_GREP:
        return (compile(code, "<snippet>", "eval"), True)

    if mode in (MODE_XFORM, MODE_GENERATE):
        return (compile(code, "<snippet>", "exec"), False)

    # MODE_EVAL — try expression first (returns value), fall back to exec
    try:
        return (compile(code, "<snippet>", "eval"), True)
    except SyntaxError:
        return (compile(code, "<snippet>", "exec"), False)


def main() -> None:  # noqa: C901 – intentional monolith for a small runner
    """Entry point for the snippet runner."""
    # ---- Read init message --------------------------------------------------
    init = read_message()
    if init is None:
        send_error("No init message received")
        return
    if init.get("type") != "init":
        send_error(f"Expected init message, got: {init.get('type')}")
        return

    code: str = init["code"]
    mode: str = init["mode"]

    if mode not in VALID_MODES:
        send_error(f"Invalid mode: {mode!r}. Must be one of {sorted(VALID_MODES)}")
        return

    # ---- Compile snippet ----------------------------------------------------
    try:
        compiled, is_expression = _compile_snippet(code, mode)
    except SyntaxError as exc:
        send_error(f"SyntaxError in snippet: {exc}")
        return

    # ---- Process records ----------------------------------------------------
    line_num = 0

    while True:
        msg = read_message()
        if msg is None:
            break  # EOF
        msg_type = msg.get("type")
        if msg_type == MSG_DONE:
            break
        if msg_type != MSG_RECORD:
            continue

        line_num += 1
        record_data: dict[str, Any] = msg.get("data", {})
        r = Record(record_data)

        # Collected emits for xform/generate
        emitted: list[dict[str, Any]] = []

        def emit(rec_or_dict: Any) -> None:
            """Emit a record from xform/generate snippets."""
            if isinstance(rec_or_dict, Record):
                emitted.append(rec_or_dict.to_dict())
            elif isinstance(rec_or_dict, dict):
                emitted.append(rec_or_dict)
            else:
                raise TypeError(
                    f"emit() expects a Record or dict, got {type(rec_or_dict).__name__}"
                )

        def __get(rec: Record, ks: str) -> Any:
            return rec.get("@" + ks)

        def __set(rec: Record, ks: str, value: Any) -> Any:
            rec.set("@" + ks, value)
            return value

        # Build the snippet namespace
        namespace: dict[str, Any] = {
            "r": r,
            "record": r,
            "line_num": line_num,
            "filename": "NONE",
            "emit": emit,
            "Record": Record,
            "__get": __get,
            "__set": __set,
            # Expose builtins for convenience
            "json": __import__("json"),
            "re": __import__("re"),
            "math": __import__("math"),
        }

        try:
            if mode == MODE_GREP:
                result = eval(compiled, {"__builtins__": __builtins__}, namespace)
                ok = send_filter(bool(result))
                if not ok:
                    return
            elif mode == MODE_EVAL:
                if is_expression:
                    result = eval(compiled, {"__builtins__": __builtins__}, namespace)
                    # If result is a dict, merge it into the record
                    if isinstance(result, dict):
                        for k, v in result.items():
                            r[k] = v
                else:
                    exec(compiled, {"__builtins__": __builtins__}, namespace)
                ok = send_result(r.to_dict())
                if not ok:
                    return
            elif mode in (MODE_XFORM, MODE_GENERATE):
                exec(compiled, {"__builtins__": __builtins__}, namespace)
                for emitted_data in emitted:
                    ok = send_emit(emitted_data)
                    if not ok:
                        return
            else:
                send_error(f"Unexpected mode: {mode}")
                return

            ok = send_record_done()
            if not ok:
                return

        except Exception:
            tb = traceback.format_exc()
            ok = send_error(f"Error processing record {line_num}: {tb}")
            if not ok:
                return
            # Send record_done even on error so the TS side knows to continue
            ok = send_record_done()
            if not ok:
                return


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        # Parent closed the pipe — exit silently
        pass
    except KeyboardInterrupt:
        pass
