#!/usr/bin/env python3
"""Tests for the RecordStream Python SDK.

Run with: python3 test_sdk.py
Uses only the stdlib ``unittest`` module.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import unittest
from typing import Any

# Add the SDK source directory to the path so we can import directly.
SDK_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "src", "snippets", "python"
)
sys.path.insert(0, os.path.abspath(SDK_DIR))

from recs_sdk import Record, NoSuchKeyError, _parse_keyspec  # noqa: E402
from protocol import (  # noqa: E402
    MSG_INIT,
    MSG_RECORD,
    MSG_DONE,
    MSG_RESULT,
    MSG_FILTER,
    MSG_EMIT,
    MSG_RECORD_DONE,
    MSG_ERROR,
    VALID_MODES,
)


# =========================================================================
# Record basics
# =========================================================================


class TestRecordBasics(unittest.TestCase):
    """Test Record creation, access, and modification."""

    def test_create_and_access(self) -> None:
        r = Record({"name": "alice", "age": 30})
        self.assertEqual(r["name"], "alice")
        self.assertEqual(r["age"], 30)

    def test_setitem(self) -> None:
        r = Record({"x": 1})
        r["y"] = 2
        self.assertEqual(r["y"], 2)

    def test_delitem(self) -> None:
        r = Record({"x": 1, "y": 2})
        del r["x"]
        self.assertNotIn("x", r)

    def test_contains(self) -> None:
        r = Record({"a": 1})
        self.assertIn("a", r)
        self.assertNotIn("b", r)

    def test_len(self) -> None:
        r = Record({"a": 1, "b": 2})
        self.assertEqual(len(r), 2)

    def test_iter(self) -> None:
        r = Record({"a": 1, "b": 2})
        self.assertEqual(sorted(r), ["a", "b"])

    def test_keys_values_items(self) -> None:
        data: dict[str, Any] = {"x": 10, "y": 20}
        r = Record(data)
        self.assertEqual(sorted(r.keys()), ["x", "y"])
        self.assertEqual(sorted(r.values()), [10, 20])
        self.assertEqual(sorted(r.items()), [("x", 10), ("y", 20)])

    def test_to_dict(self) -> None:
        r = Record({"a": 1})
        d = r.to_dict()
        self.assertEqual(d, {"a": 1})
        # Should be a copy
        d["b"] = 2
        self.assertNotIn("b", r)

    def test_repr(self) -> None:
        r = Record({"a": 1})
        self.assertIn("Record(", repr(r))

    def test_equality(self) -> None:
        r1 = Record({"a": 1})
        r2 = Record({"a": 1})
        r3 = Record({"a": 2})
        self.assertEqual(r1, r2)
        self.assertNotEqual(r1, r3)


# =========================================================================
# KeySpec parsing
# =========================================================================


class TestKeySpecParsing(unittest.TestCase):
    """Test the _parse_keyspec helper."""

    def test_simple_key(self) -> None:
        keys, fuzzy = _parse_keyspec("name")
        self.assertEqual(keys, ["name"])
        self.assertFalse(fuzzy)

    def test_nested_key(self) -> None:
        keys, fuzzy = _parse_keyspec("foo/bar/baz")
        self.assertEqual(keys, ["foo", "bar", "baz"])
        self.assertFalse(fuzzy)

    def test_fuzzy_prefix(self) -> None:
        keys, fuzzy = _parse_keyspec("@name")
        self.assertEqual(keys, ["name"])
        self.assertTrue(fuzzy)

    def test_escaped_slash(self) -> None:
        keys, fuzzy = _parse_keyspec("foo\\/bar")
        self.assertEqual(keys, ["foo/bar"])
        self.assertFalse(fuzzy)

    def test_array_index(self) -> None:
        keys, fuzzy = _parse_keyspec("items/#0")
        self.assertEqual(keys, ["items", "#0"])


# =========================================================================
# KeySpec get / set / has
# =========================================================================


class TestKeySpecAccess(unittest.TestCase):
    """Test Record.get() and Record.set() with various key specs."""

    def test_simple_get(self) -> None:
        r = Record({"first_key": "foo", "second_key": {"bar": "biz"}})
        self.assertEqual(r.get("first_key"), "foo")

    def test_nested_get(self) -> None:
        r = Record({"a": {"b": {"c": 42}}})
        self.assertEqual(r.get("a/b/c"), 42)

    def test_missing_key_returns_none(self) -> None:
        r = Record({"a": 1})
        self.assertIsNone(r.get("nonexistent"))

    def test_deep_missing_returns_none(self) -> None:
        r = Record({"a": {"b": 1}})
        self.assertIsNone(r.get("a/x/y"))

    def test_array_index(self) -> None:
        r = Record({"items": [10, 20, 30]})
        self.assertEqual(r.get("items/#1"), 20)

    def test_nested_array(self) -> None:
        r = Record({"data": [{"name": "a"}, {"name": "b"}]})
        self.assertEqual(r.get("data/#1/name"), "b")

    def test_set_simple(self) -> None:
        r = Record({"a": 1})
        r.set("b", 2)
        self.assertEqual(r["b"], 2)

    def test_set_nested(self) -> None:
        r = Record({})
        r.set("a/b/c", 42)
        self.assertEqual(r["a"]["b"]["c"], 42)

    def test_set_creates_intermediate_array(self) -> None:
        r = Record({})
        r.set("items/#0", "hello")
        self.assertIsInstance(r["items"], list)
        self.assertEqual(r["items"][0], "hello")

    def test_has_existing(self) -> None:
        r = Record({"a": {"b": 1}})
        self.assertTrue(r.has("a/b"))

    def test_has_missing(self) -> None:
        r = Record({"a": 1})
        self.assertFalse(r.has("b"))

    def test_has_deep_missing(self) -> None:
        r = Record({"a": {"b": 1}})
        self.assertFalse(r.has("a/x"))


# =========================================================================
# Fuzzy matching
# =========================================================================


class TestFuzzyMatching(unittest.TestCase):
    """Test fuzzy key resolution via @ prefix."""

    def test_prefix_match(self) -> None:
        r = Record({"first_key": "foo", "second_key": "bar"})
        self.assertEqual(r.get("@first"), "foo")

    def test_nested_fuzzy(self) -> None:
        r = Record({"second_key": {"bar": "biz"}})
        self.assertEqual(r.get("@cond/ar"), "biz")

    def test_regex_match(self) -> None:
        r = Record({"my_long_key": 42})
        self.assertEqual(r.get("@long"), 42)

    def test_exact_preferred_in_fuzzy(self) -> None:
        r = Record({"ab": 1, "abc": 2})
        self.assertEqual(r.get("@ab"), 1)

    def test_number_key_fuzzy(self) -> None:
        r = Record({"0": "zero"})
        self.assertEqual(r.get("@0"), "zero")


# =========================================================================
# Runner integration (subprocess protocol)
# =========================================================================


RUNNER_PATH = os.path.join(SDK_DIR, "runner.py")


def _run_session(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Spawn the runner and feed it JSONL messages, collecting responses."""
    input_text = "\n".join(json.dumps(m) for m in messages) + "\n"
    proc = subprocess.run(
        [sys.executable, RUNNER_PATH],
        input=input_text,
        capture_output=True,
        text=True,
        timeout=10,
        cwd=SDK_DIR,
    )
    responses: list[dict[str, Any]] = []
    for line in proc.stdout.strip().split("\n"):
        if line:
            responses.append(json.loads(line))
    return responses


class TestRunnerGrep(unittest.TestCase):
    """Test grep mode via subprocess."""

    def test_grep_pass(self) -> None:
        msgs: list[dict[str, Any]] = [
            {"type": "init", "code": "r['age'] > 20", "mode": "grep"},
            {"type": "record", "data": {"name": "alice", "age": 30}},
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        self.assertTrue(any(m["type"] == "filter" and m["passed"] is True for m in resp))
        self.assertTrue(any(m["type"] == "record_done" for m in resp))

    def test_grep_fail(self) -> None:
        msgs: list[dict[str, Any]] = [
            {"type": "init", "code": "r['age'] > 50", "mode": "grep"},
            {"type": "record", "data": {"name": "alice", "age": 30}},
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        self.assertTrue(any(m["type"] == "filter" and m["passed"] is False for m in resp))


class TestRunnerEval(unittest.TestCase):
    """Test eval mode via subprocess."""

    def test_eval_expression(self) -> None:
        msgs: list[dict[str, Any]] = [
            {"type": "init", "code": "r['computed'] = r['age'] * 2", "mode": "eval"},
            {"type": "record", "data": {"name": "alice", "age": 30}},
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        results = [m for m in resp if m["type"] == "result"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["data"]["computed"], 60)

    def test_eval_preserves_original_fields(self) -> None:
        msgs: list[dict[str, Any]] = [
            {"type": "init", "code": "r['x'] = 1", "mode": "eval"},
            {"type": "record", "data": {"name": "bob"}},
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        results = [m for m in resp if m["type"] == "result"]
        self.assertEqual(results[0]["data"]["name"], "bob")
        self.assertEqual(results[0]["data"]["x"], 1)


class TestRunnerXform(unittest.TestCase):
    """Test xform mode via subprocess."""

    def test_xform_emit_multiple(self) -> None:
        msgs: list[dict[str, Any]] = [
            {
                "type": "init",
                "code": "emit({'a': 1})\nemit({'b': 2})",
                "mode": "xform",
            },
            {"type": "record", "data": {"name": "alice"}},
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        emits = [m for m in resp if m["type"] == "emit"]
        self.assertEqual(len(emits), 2)
        self.assertEqual(emits[0]["data"], {"a": 1})
        self.assertEqual(emits[1]["data"], {"b": 2})

    def test_xform_emit_none(self) -> None:
        """xform can drop records by not emitting."""
        msgs: list[dict[str, Any]] = [
            {"type": "init", "code": "pass", "mode": "xform"},
            {"type": "record", "data": {"name": "alice"}},
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        emits = [m for m in resp if m["type"] == "emit"]
        self.assertEqual(len(emits), 0)
        self.assertTrue(any(m["type"] == "record_done" for m in resp))


class TestRunnerGenerate(unittest.TestCase):
    """Test generate mode via subprocess."""

    def test_generate(self) -> None:
        msgs: list[dict[str, Any]] = [
            {
                "type": "init",
                "code": (
                    "for i in range(3):\n"
                    "    emit({'i': i, 'from': r['name']})"
                ),
                "mode": "generate",
            },
            {"type": "record", "data": {"name": "src"}},
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        emits = [m for m in resp if m["type"] == "emit"]
        self.assertEqual(len(emits), 3)
        self.assertEqual(emits[0]["data"]["i"], 0)
        self.assertEqual(emits[2]["data"]["from"], "src")


class TestRunnerErrors(unittest.TestCase):
    """Test error handling in the runner."""

    def test_syntax_error(self) -> None:
        msgs: list[dict[str, Any]] = [
            {"type": "init", "code": "def (bad", "mode": "eval"},
        ]
        resp = _run_session(msgs)
        errors = [m for m in resp if m["type"] == "error"]
        self.assertTrue(len(errors) >= 1)
        self.assertIn("SyntaxError", errors[0]["message"])

    def test_runtime_error(self) -> None:
        msgs: list[dict[str, Any]] = [
            {"type": "init", "code": "r['missing_key']", "mode": "grep"},
            {"type": "record", "data": {"name": "alice"}},
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        errors = [m for m in resp if m["type"] == "error"]
        self.assertTrue(len(errors) >= 1)
        self.assertIn("KeyError", errors[0]["message"])

    def test_invalid_mode(self) -> None:
        msgs: list[dict[str, Any]] = [
            {"type": "init", "code": "pass", "mode": "bad_mode"},
        ]
        resp = _run_session(msgs)
        errors = [m for m in resp if m["type"] == "error"]
        self.assertTrue(len(errors) >= 1)
        self.assertIn("Invalid mode", errors[0]["message"])

    def test_multiple_records_error_continues(self) -> None:
        """After an error the runner should keep processing records."""
        msgs: list[dict[str, Any]] = [
            {"type": "init", "code": "r['age'] > 20", "mode": "grep"},
            {"type": "record", "data": {"name": "alice"}},  # no age → error
            {"type": "record", "data": {"name": "bob", "age": 30}},  # ok
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        errors = [m for m in resp if m["type"] == "error"]
        filters = [m for m in resp if m["type"] == "filter"]
        self.assertTrue(len(errors) >= 1)
        self.assertTrue(len(filters) >= 1)
        self.assertTrue(filters[0]["passed"])


class TestRunnerEmitRecord(unittest.TestCase):
    """Test that emit() works with Record objects too."""

    def test_emit_record_object(self) -> None:
        msgs: list[dict[str, Any]] = [
            {
                "type": "init",
                "code": "emit(Record({'new': True}))",
                "mode": "xform",
            },
            {"type": "record", "data": {"old": True}},
            {"type": "done"},
        ]
        resp = _run_session(msgs)
        emits = [m for m in resp if m["type"] == "emit"]
        self.assertEqual(len(emits), 1)
        self.assertEqual(emits[0]["data"], {"new": True})


if __name__ == "__main__":
    unittest.main()
