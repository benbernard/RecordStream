"""RecordStream JSONL protocol constants and helpers.

Defines the message types exchanged between the TypeScript host process
and the Python snippet runner over stdin/stdout.
"""

from __future__ import annotations

import json
import sys
from typing import Any


# --- Inbound message types (TS -> Python) ---

MSG_INIT: str = "init"
MSG_RECORD: str = "record"
MSG_DONE: str = "done"

# --- Outbound message types (Python -> TS) ---

MSG_RESULT: str = "result"
MSG_FILTER: str = "filter"
MSG_EMIT: str = "emit"
MSG_RECORD_DONE: str = "record_done"
MSG_ERROR: str = "error"

# --- Snippet execution modes ---

MODE_EVAL: str = "eval"
MODE_GREP: str = "grep"
MODE_XFORM: str = "xform"
MODE_GENERATE: str = "generate"

VALID_MODES: frozenset[str] = frozenset({MODE_EVAL, MODE_GREP, MODE_XFORM, MODE_GENERATE})


def read_message() -> dict[str, Any] | None:
    """Read a single JSONL message from stdin.

    Returns:
        Parsed message dict, or None on EOF.
    """
    try:
        line = sys.stdin.readline()
    except (IOError, OSError):
        return None
    if not line:
        return None
    return json.loads(line)  # type: ignore[no-any-return]


def write_message(msg: dict[str, Any]) -> bool:
    """Write a single JSONL message to stdout.

    Returns:
        True on success, False on broken pipe.
    """
    try:
        sys.stdout.write(json.dumps(msg, separators=(",", ":")) + "\n")
        sys.stdout.flush()
        return True
    except BrokenPipeError:
        return False


def send_result(data: dict[str, Any]) -> bool:
    """Send a result message (eval mode)."""
    return write_message({"type": MSG_RESULT, "data": data})


def send_filter(passed: bool) -> bool:
    """Send a filter message (grep mode)."""
    return write_message({"type": MSG_FILTER, "passed": passed})


def send_emit(data: dict[str, Any]) -> bool:
    """Send an emit message (xform/generate mode)."""
    return write_message({"type": MSG_EMIT, "data": data})


def send_record_done() -> bool:
    """Signal that the current record has been fully processed."""
    return write_message({"type": MSG_RECORD_DONE})


def send_error(message: str) -> bool:
    """Send an error message."""
    return write_message({"type": MSG_ERROR, "message": message})
