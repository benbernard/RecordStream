"""RecordStream Python SDK for snippet execution.

Provides the Record class with KeySpec support for navigating nested
data structures, matching the semantics of the TypeScript KeySpec module.
"""

from __future__ import annotations

import re
from typing import Any


class NoSuchKeyError(KeyError):
    """Raised when a key spec cannot be resolved."""


class Record:
    """JSON record wrapper with KeySpec support.

    Wraps a plain dict and provides KeySpec-based access for navigating
    nested structures using ``/`` for nesting, ``#N`` for array indices,
    and ``@`` prefix for fuzzy matching.
    """

    __slots__ = ("_data",)

    def __init__(self, data: dict[str, Any]) -> None:
        self._data: dict[str, Any] = data

    # --- KeySpec access ---

    def get(self, keyspec: str) -> Any:
        """Get value by KeySpec.

        Supports ``/`` for nesting, ``#N`` for arrays, ``@`` prefix for
        fuzzy matching.

        Args:
            keyspec: Key specification string.

        Returns:
            The resolved value, or ``None`` if the path does not exist.
        """
        keys, fuzzy = _parse_keyspec(keyspec)
        result = _resolve(self._data, keys, 0, fuzzy, no_vivify=True, throw_error=False)
        return result[0]

    def set(self, keyspec: str, value: Any) -> None:
        """Set value by KeySpec, creating intermediate dicts/lists.

        Args:
            keyspec: Key specification string.
            value: Value to set at the resolved location.
        """
        keys, fuzzy = _parse_keyspec(keyspec)
        _set_nested(self._data, keys, value, fuzzy)

    def has(self, keyspec: str) -> bool:
        """Check whether a KeySpec path exists in the record.

        Args:
            keyspec: Key specification string.

        Returns:
            True if the path exists.
        """
        keys, fuzzy = _parse_keyspec(keyspec)
        try:
            _resolve(self._data, keys, 0, fuzzy, no_vivify=True, throw_error=True)
            return True
        except NoSuchKeyError:
            return False

    def remove(self, *keys: str) -> list[Any]:
        """Remove one or more fields. Returns list of old values."""
        old = []
        for key in keys:
            old.append(self._data.pop(key, None))
        return old

    def rename(self, old_key: str, new_key: str) -> None:
        """Rename a field. If old field doesn't exist, creates new field with None."""
        value = self._data.get(old_key)
        self._data[new_key] = value
        self._data.pop(old_key, None)

    def prune_to(self, *keys: str) -> None:
        """Remove all fields except those specified."""
        keep = set(keys)
        for key in list(self._data.keys()):
            if key not in keep:
                del self._data[key]

    # --- dict-like interface ---

    def __getitem__(self, key: str) -> Any:
        return self._data[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self._data[key] = value

    def __delitem__(self, key: str) -> None:
        del self._data[key]

    def __contains__(self, key: object) -> bool:
        return key in self._data

    def __iter__(self) -> Any:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)

    def __repr__(self) -> str:
        return f"Record({self._data!r})"

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Record):
            return self._data == other._data
        return NotImplemented

    def keys(self) -> list[str]:
        """Return the top-level keys."""
        return list(self._data.keys())

    def values(self) -> list[Any]:
        """Return the top-level values."""
        return list(self._data.values())

    def items(self) -> list[tuple[str, Any]]:
        """Return the top-level items."""
        return list(self._data.items())

    def to_dict(self) -> dict[str, Any]:
        """Return a shallow copy of the underlying dict."""
        return dict(self._data)

    def data_ref(self) -> dict[str, Any]:
        """Return a reference to the underlying dict (no copy)."""
        return self._data


# ---------------------------------------------------------------------------
# KeySpec parsing
# ---------------------------------------------------------------------------

def _parse_keyspec(spec: str) -> tuple[list[str], bool]:
    """Parse a key spec string into component keys and fuzzy flag.

    Args:
        spec: The raw key specification.

    Returns:
        A tuple of (parsed_keys, is_fuzzy).
    """
    fuzzy = False
    raw = spec

    if raw.startswith("@"):
        fuzzy = True
        raw = raw[1:]

    keys: list[str] = []
    current: list[str] = []
    last_char = ""

    for ch in raw:
        if ch == "/" and last_char != "\\":
            keys.append("".join(current))
            current = []
            last_char = ""
            continue

        if ch == "/" and last_char == "\\":
            # Escaped slash – remove preceding backslash
            current.pop()

        current.append(ch)
        last_char = ch

    if current:
        keys.append("".join(current))

    return keys, fuzzy


# ---------------------------------------------------------------------------
# Key resolution
# ---------------------------------------------------------------------------

def _guess_key_name(
    data: Any,
    search: str,
    fuzzy: bool,
) -> str:
    """Determine the actual key to use for *search* in *data*.

    Handles array index notation (``#N``) and fuzzy matching.
    """
    if isinstance(data, list):
        m = re.match(r"^#(\d+)$", search)
        if m:
            return m.group(1)
        raise KeyError(
            f"Cannot select non-numeric index: {search} "
            "(did you forget to prefix with a '#'?) for array"
        )

    if not fuzzy:
        return search

    if not isinstance(data, dict):
        return search

    # 1. Exact match
    if search in data:
        return search

    sorted_keys = sorted(data.keys())
    lower_search = search.lower()

    # 2. Prefix match (case insensitive) – last match wins (matches TS)
    found: str | None = None
    for key in sorted_keys:
        if key.lower().startswith(lower_search):
            found = key

    if found is not None:
        return found

    # 3. Regex match (case insensitive) – last match wins
    try:
        pattern = re.compile(search, re.IGNORECASE)
        for key in sorted_keys:
            if pattern.search(key):
                found = key
    except re.error:
        pass

    if found is not None:
        return found

    return search


def _resolve(
    data: Any,
    keys: list[str],
    index: int,
    fuzzy: bool,
    *,
    no_vivify: bool,
    throw_error: bool,
) -> tuple[Any, bool]:
    """Recursively resolve a key spec path.

    Returns:
        (value, found) tuple.
    """
    if index >= len(keys):
        return (data, True)

    search = keys[index]

    if data is None:
        if throw_error:
            raise NoSuchKeyError(search)
        if no_vivify:
            return (None, False)

    if not isinstance(data, (dict, list)):
        if data is not None:
            raise TypeError(
                f"Cannot look for {search!r} in scalar: {data!r}"
            )

    key = _guess_key_name(data, search, fuzzy)

    if isinstance(data, list):
        idx = int(key)
        if idx >= len(data):
            if throw_error:
                raise NoSuchKeyError(search)
            if no_vivify:
                return (None, False)
        value = data[idx] if idx < len(data) else None
    else:
        assert isinstance(data, dict)
        if key not in data:
            if throw_error:
                raise NoSuchKeyError(search)
            if no_vivify:
                return (None, False)
        value = data.get(key)

    is_last = index == len(keys) - 1

    if not is_last:
        if value is None:
            if throw_error:
                raise NoSuchKeyError(search)
            if no_vivify:
                return (None, False)
            # Vivify intermediate
            next_key = keys[index + 1]
            value = [] if next_key.startswith("#") else {}
            if isinstance(data, list):
                data[int(key)] = value
            else:
                data[key] = value

        return _resolve(value, keys, index + 1, fuzzy, no_vivify=no_vivify, throw_error=throw_error)

    return (value, True)


def _set_nested(
    data: dict[str, Any],
    keys: list[str],
    value: Any,
    fuzzy: bool,
) -> None:
    """Set a value at a nested key spec location, creating intermediates."""
    current: Any = data

    for i in range(len(keys) - 1):
        search = keys[i]
        key = _guess_key_name(current, search, fuzzy)

        if isinstance(current, list):
            idx = int(key)
            nxt = current[idx] if idx < len(current) else None
        else:
            nxt = current.get(key)

        if nxt is None:
            next_key = keys[i + 1]
            nxt = [] if next_key.startswith("#") else {}
            if isinstance(current, list):
                current[int(key)] = nxt
            else:
                current[key] = nxt

        current = nxt

    last_search = keys[-1]
    final_key = _guess_key_name(current, last_search, fuzzy)

    if isinstance(current, list):
        idx = int(final_key)
        # Extend list if needed
        while len(current) <= idx:
            current.append(None)
        current[idx] = value
    else:
        current[final_key] = value
